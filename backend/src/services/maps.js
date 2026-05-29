import mongoose from 'mongoose';
import Hospital from '../models/hospital.js';

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DEFAULT_HOSPITAL_RESULT_LIMIT = 20;
const DEFAULT_SEARCH_RADIUS_KM = 25;
const DEFAULT_MIN_CACHED_HOSPITALS = 5;
const DEFAULT_MIN_HOSPITAL_RESULTS = 5;
const DEFAULT_CACHE_TTL_DAYS = 30;
const HOSPITAL_CACHE_QUALITY_VERSION = 2;
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter'
];

function getBoundedNumber(envName, fallback, min, max) {
  const parsed = Number(process.env[envName] || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function getHospitalResultLimit() {
  return getBoundedNumber('HOSPITAL_RESULT_LIMIT', DEFAULT_HOSPITAL_RESULT_LIMIT, 8, 40);
}

function getHospitalSearchRadiusKm() {
  return getBoundedNumber('HOSPITAL_SEARCH_RADIUS_KM', DEFAULT_SEARCH_RADIUS_KM, 3, 50);
}

function getMinCachedHospitals() {
  return getBoundedNumber('MIN_CACHED_HOSPITALS', DEFAULT_MIN_CACHED_HOSPITALS, 1, 20);
}

function getMinHospitalResults() {
  return getBoundedNumber('MIN_HOSPITAL_RESULTS', DEFAULT_MIN_HOSPITAL_RESULTS, 1, 20);
}

function getCacheTtlDays() {
  return getBoundedNumber('HOSPITAL_CACHE_TTL_DAYS', DEFAULT_CACHE_TTL_DAYS, 1, 180);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function sourceKey(source, sourceId, name, lat, lng) {
  if (sourceId) return `${source}:${sourceId}`;
  return `${source}:${normalizeText(name)}:${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
}

function getHospitalProvider() {
  const provider = normalizeText(process.env.MAP_PROVIDER || 'osm');
  return provider === 'google' ? 'google' : 'osm';
}

function dedupeHospitals(hospitals) {
  const seen = new Set();
  return hospitals.filter((hospital) => {
    const keys = [
      hospital.sourceKey || hospital.id,
      `${normalizeText(hospital.name)}-${Number(hospital.lat).toFixed(3)}-${Number(hospital.lng).toFixed(3)}`
    ].filter(Boolean);
    if (keys.some((key) => seen.has(key))) return false;
    for (const key of keys) seen.add(key);
    return true;
  });
}

function facilityText(hospital) {
  return normalizeText([hospital.name, hospital.address, ...(hospital.types || [])].join(' '));
}

function getFacilityKind(hospital) {
  const infoText = facilityText(hospital);
  const nameText = normalizeText(hospital.name);
  const typeText = normalizeText((hospital.types || []).join(' '));
  const strongHospitalPattern = /\b(hospital|medical college|medical sciences|medical institute|trauma|casualty|nursing home|multispeciality|multi speciality|multi-speciality|multi specialty|multi-specialty|multispecialty|super speciality|super-speciality|super specialty|super-specialty|cancer centre|cancer center|cancer institute)\b/;

  if (/\b(pharmacy|chemist|medical store|drug store|diagnostic|pathology|laboratory|lab|x-ray|xray|scan|imaging|collection center|blood bank)\b/.test(infoText)) {
    return 'excluded';
  }

  if (
    /\b(clinic|homeopathy|homeo|ayurveda|ayurvedic|home care|health care|yoga|dental|dentist|physio|physiotherapy|skin care|eye care|sight|retina|vision)\b/.test(nameText) &&
    !strongHospitalPattern.test(nameText)
  ) {
    return 'clinic';
  }

  if (
    /\bhospital\b/.test(typeText) ||
    strongHospitalPattern.test(infoText)
  ) {
    return 'hospital';
  }

  if (/\b(clinic|doctor|doctors|physician|dispensary|polyclinic|dental|dentist|physio|physiotherapy|homeopathy|ayurvedic|eye care|skin care)\b/.test(infoText)) {
    return 'clinic';
  }

  return 'unknown';
}

function getDepartmentKeywords(department) {
  const normalized = normalizeText(department);
  const stopWords = new Set(['care', 'general', 'medicine', 'medical', 'department', 'hospital']);
  const words = normalized
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !stopWords.has(word));
  const keywords = new Set(words);

  const groups = [
    { match: /cancer|onco|tumou?r|chemo/, words: ['cancer', 'oncology', 'oncologist', 'chemo', 'radiotherapy'] },
    { match: /gastro|stomach|abdom|digest|surgery|general medicine/, words: ['gastro', 'gastroenterology', 'digestive', 'surgery', 'general'] },
    { match: /cardio|heart|chest/, words: ['cardiac', 'cardio', 'heart', 'cardiology'] },
    { match: /neuro|brain|stroke/, words: ['neuro', 'neurology', 'brain', 'stroke'] },
    { match: /ortho|bone|fracture/, words: ['ortho', 'orthopedic', 'orthopaedic', 'bone', 'trauma'] },
    { match: /pediatric|paediatric|child/, words: ['pediatric', 'paediatric', 'child', 'children'] },
    { match: /gynec|gynae|obstetric|pregnancy|maternity/, words: ['gynecology', 'gynaecology', 'maternity', 'women', 'obstetric'] },
    { match: /eye|ophthal|vision/, words: ['eye', 'ophthalmology', 'sight', 'vision'] },
    { match: /emergency|critical|trauma/, words: ['emergency', 'trauma', 'casualty'] }
  ];

  for (const group of groups) {
    if (group.match.test(normalized)) {
      for (const word of group.words) keywords.add(word);
    }
  }

  return [...keywords];
}

function departmentMatchScore(infoText, department) {
  const keywords = getDepartmentKeywords(department);
  if (!keywords.length) return 1;
  if (keywords.some((keyword) => infoText.includes(keyword))) return 1.55;
  return 1;
}

function specialtyMismatchPenalty(infoText, department) {
  const keywords = getDepartmentKeywords(department);
  const matchesDepartment = keywords.some((keyword) => infoText.includes(keyword));
  const specialtyGroups = [
    { pattern: /\b(eye|sight|retina|ophthal|vision)\b/, keywords: ['eye', 'sight', 'retina', 'ophthalmology', 'vision'] },
    { pattern: /\b(maternity|women|mother care|gynec|gynae|obstetric|pregnancy)\b/, keywords: ['maternity', 'women', 'mother', 'gynecology', 'gynaecology', 'obstetric'] },
    { pattern: /\b(child|children|pediatric|paediatric)\b/, keywords: ['child', 'children', 'pediatric', 'paediatric'] },
    { pattern: /\b(dental|dentist)\b/, keywords: ['dental', 'dentist'] },
    { pattern: /\b(homeopathy|homeo|ayurveda|ayurvedic|yoga)\b/, keywords: ['homeopathy', 'homeo', 'ayurveda', 'ayurvedic'] }
  ];

  for (const group of specialtyGroups) {
    if (group.pattern.test(infoText) && !matchesDepartment && !group.keywords.some((keyword) => keywords.includes(keyword))) {
      return 0.1;
    }
  }

  return 1;
}

function countDepartmentMatches(candidates, department) {
  return candidates.filter((candidate) => departmentMatchScore(facilityText(candidate), department) > 1).length;
}

function hasSpecializedDepartment(department) {
  return /cancer|onco|cardio|heart|neuro|brain|ortho|bone|gastro|digest|abdom|pediatric|paediatric|gynec|gynae|maternity|eye|ophthal|skin|derma|ent|kidney|renal|urology/.test(
    normalizeText(department)
  );
}

function countHospitalLike(candidates) {
  return candidates.filter((candidate) => getFacilityKind(candidate) === 'hospital').length;
}

function facilitySortRank(hospital) {
  const kind = getFacilityKind(hospital);
  if (kind === 'hospital') return 3;
  if (kind === 'unknown') return 2;
  if (kind === 'clinic') return 1;
  return 0;
}

function emergencyScore(hospital, severity, department) {
  const severityWeight = { low: 1, moderate: 2, high: 3, critical: 4 }[severity] || 2;
  const infoText = facilityText(hospital);
  const facilityKind = getFacilityKind(hospital);
  if (facilityKind === 'excluded') return -999;
  const deptMatch = departmentMatchScore(infoText, department);
  const specialtyPenalty = specialtyMismatchPenalty(infoText, department);
  const facilityWeight = facilityKind === 'hospital' ? 2.2 : severityWeight >= 3 ? 0.35 : 0.65;
  const rating = hospital.rating || 3.5;
  const etaMinutes = hospital.etaMinutes || Math.max(4, Math.round((hospital.distanceKm || 1) * 4));
  const distancePenalty = Math.max(1, hospital.distanceKm / (severityWeight >= 3 ? 1.8 : 2.5));
  const etaPenalty = Math.max(1, etaMinutes / (severityWeight >= 3 ? 10 : 16));
  return Number(((severityWeight * rating * deptMatch * facilityWeight * specialtyPenalty) / Math.max(distancePenalty, etaPenalty)).toFixed(2));
}

function validLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function fallbackHospitals(lat, lng, department, severity) {
  const base = [
    {
      id: 'fallback-1',
      name: 'City Emergency Hospital',
      rating: 4.4,
      distanceKm: 1.8,
      etaMinutes: 8,
      address: 'Main Road, Nearby',
      phone: '',
      specialization: department,
      emergencySuitability: 0,
      lat: lat + 0.008,
      lng: lng + 0.008,
      types: ['hospital', 'emergency']
    },
    {
      id: 'fallback-2',
      name: 'Care Plus Multi-Speciality',
      rating: 4.2,
      distanceKm: 3.1,
      etaMinutes: 13,
      address: 'Community Center Area',
      phone: '',
      specialization: department,
      emergencySuitability: 0,
      lat: lat - 0.009,
      lng: lng + 0.006,
      types: ['hospital']
    },
    {
      id: 'fallback-3',
      name: 'District General Hospital',
      rating: 4.0,
      distanceKm: 4.7,
      etaMinutes: 18,
      address: 'District Hospital Zone',
      phone: '',
      specialization: department,
      emergencySuitability: 0,
      lat: lat + 0.012,
      lng: lng - 0.01,
      types: ['hospital', 'general']
    }
  ];

  for (const hospital of base) {
    hospital.emergencySuitability = emergencyScore(hospital, severity, department);
  }

  base.sort((a, b) => b.emergencySuitability - a.emergencySuitability);
  const hospitals = base.map(({ types, ...rest }) => rest);
  return { bestHospitalId: hospitals[0]?.id || '', hospitals, isFallback: true, source: 'fallback' };
}

async function getRouteEtaMinutes(fromLat, fromLng, toLat, toLng, fallbackMinutes) {
  try {
    if (!validLatLng(fromLat, fromLng) || !validLatLng(toLat, toLng)) return fallbackMinutes;
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
    const routeRes = await fetch(routeUrl);
    if (!routeRes.ok) return fallbackMinutes;
    const routeData = await routeRes.json();
    const seconds = routeData?.routes?.[0]?.duration;
    if (!seconds) return fallbackMinutes;
    return Math.max(4, Math.round(seconds / 60));
  } catch {
    return fallbackMinutes;
  }
}

async function fetchOverpassJson(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const headers = {
        Accept: 'application/json',
        'User-Agent': 'MediRouteAI/1.0'
      };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ data: query })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return response.json();
      }

      const getResponse = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { headers });
      if (!getResponse.ok) continue;
      const contentType = getResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) continue;
      return getResponse.json();
    } catch {
      // Try the next public Overpass mirror.
    }
  }

  return null;
}

function googleNearbySearchUrl(key, lat, lng, search, pageToken = '') {
  const params = new URLSearchParams({ key });
  if (pageToken) {
    params.set('pagetoken', pageToken);
  } else {
    params.set('location', `${lat},${lng}`);
    params.set('rankby', 'distance');
    if (search.type) params.set('type', search.type);
    if (search.keyword) params.set('keyword', search.keyword);
  }
  return `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
}

async function fetchGoogleNearbyPages(key, lat, lng, search, maxPages) {
  const results = [];
  let pageToken = '';

  for (let page = 0; page < maxPages; page += 1) {
    if (pageToken) await sleep(1800);

    const response = await fetch(googleNearbySearchUrl(key, lat, lng, search, pageToken));
    if (!response.ok) break;

    const data = await response.json();
    if (data.status === 'ZERO_RESULTS') break;
    if (data.status && data.status !== 'OK') break;

    results.push(...(data.results || []));
    pageToken = data.next_page_token || '';
    if (!pageToken) break;
  }

  return results;
}

function dedupeGooglePlaces(places) {
  const seen = new Set();
  return places.filter((place) => {
    const hLat = place.geometry?.location?.lat;
    const hLng = place.geometry?.location?.lng;
    const key = place.place_id || `${normalizeText(place.name)}-${Number(hLat).toFixed(5)}-${Number(hLng).toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchGoogleHospitalCandidates(key, lat, lng) {
  const primary = await fetchGoogleNearbyPages(key, lat, lng, { type: 'hospital' }, 3);
  const broaderSearches = [
    { keyword: 'hospital' },
    { keyword: 'emergency hospital' },
    { keyword: 'multi speciality hospital' },
    { keyword: 'nursing home' },
    { keyword: 'medical center' },
    { keyword: 'clinic' }
  ];

  const broader = await Promise.all(
    broaderSearches.map((search) => fetchGoogleNearbyPages(key, lat, lng, search, 1))
  );

  return dedupeGooglePlaces([...primary, ...broader.flat()]);
}

function formatOsmAddress(tags = {}) {
  return (
    tags['addr:full'] ||
    [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']]
      .filter(Boolean)
      .join(', ') ||
    'Address unavailable'
  );
}

function osmElementToHospitalDocument(element) {
  const tags = element.tags || {};
  const hLat = element.lat ?? element.center?.lat;
  const hLng = element.lon ?? element.center?.lon;
  if (!validLatLng(hLat, hLng)) return null;

  const sourceId = `${element.type}-${element.id}`;
  const name = tags.name || tags.operator || 'Nearby Medical Facility';
  const types = [
    tags.amenity,
    tags.healthcare,
    tags.emergency === 'yes' ? 'emergency' : '',
    tags.healthcare_speciality
  ].filter(Boolean);

  return {
    source: 'osm',
    sourceId,
    sourceKey: sourceKey('osm', sourceId, name, hLat, hLng),
    name,
    normalizedName: normalizeText(name),
    rating: 4.0,
    address: formatOsmAddress(tags),
    phone: tags.phone || tags['contact:phone'] || '',
    types: types.length ? types : ['medical'],
    lat: hLat,
    lng: hLng
  };
}

function googlePlaceToHospitalDocument(place) {
  const hLat = place.geometry?.location?.lat;
  const hLng = place.geometry?.location?.lng;
  if (!validLatLng(hLat, hLng)) return null;

  const sourceId = place.place_id || '';
  const name = place.name || 'Nearby Medical Facility';

  return {
    source: 'google',
    sourceId,
    sourceKey: sourceKey('google', sourceId, name, hLat, hLng),
    name,
    normalizedName: normalizeText(name),
    rating: place.rating || 3.8,
    address: place.vicinity || 'Address unavailable',
    phone: '',
    types: place.types || [],
    lat: hLat,
    lng: hLng
  };
}

function hospitalDocumentToCandidate(doc, lat, lng, department) {
  const coordinates = doc.location?.coordinates || [doc.lng, doc.lat];
  const hLng = coordinates[0];
  const hLat = coordinates[1];
  if (!validLatLng(hLat, hLng)) return null;

  const distanceKm = Number(haversineKm(lat, lng, hLat, hLng).toFixed(1));
  return {
    id: doc.sourceKey || String(doc._id),
    sourceKey: doc.sourceKey,
    source: doc.source,
    name: doc.name,
    rating: doc.rating || 4.0,
    distanceKm,
    etaMinutes: Math.max(5, Math.round(distanceKm * 4)),
    address: doc.address || 'Address unavailable',
    phone: doc.phone || '',
    specialization: department,
    emergencySuitability: 0,
    types: doc.types || [],
    lat: hLat,
    lng: hLng
  };
}

function liveDocumentToCandidate(doc, lat, lng, department) {
  const distanceKm = Number(haversineKm(lat, lng, doc.lat, doc.lng).toFixed(1));
  return {
    id: doc.sourceKey,
    sourceKey: doc.sourceKey,
    source: doc.source,
    name: doc.name,
    rating: doc.rating || 4.0,
    distanceKm,
    etaMinutes: Math.max(5, Math.round(distanceKm * 4)),
    address: doc.address || 'Address unavailable',
    phone: doc.phone || '',
    specialization: department,
    emergencySuitability: 0,
    types: doc.types || [],
    lat: doc.lat,
    lng: doc.lng
  };
}

async function getCachedHospitalCandidates(lat, lng, department, radiusKm, maxResults) {
  if (!mongoReady()) return [];

  try {
    const freshSince = new Date(Date.now() - getCacheTtlDays() * 24 * 60 * 60 * 1000);
    const docs = await Hospital.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000
        }
      },
      $or: [
        { source: 'manual' },
        { lastSeenAt: { $gte: freshSince }, qualityVersion: HOSPITAL_CACHE_QUALITY_VERSION }
      ]
    })
      .limit(maxResults)
      .lean();

    return docs.map((doc) => hospitalDocumentToCandidate(doc, lat, lng, department)).filter(Boolean);
  } catch {
    return [];
  }
}

async function upsertHospitalDocuments(documents) {
  if (!mongoReady() || !documents.length) return;

  const operations = documents
    .filter((doc) => doc.sourceKey && validLatLng(doc.lat, doc.lng))
    .filter((doc) => getFacilityKind(doc) !== 'excluded')
    .map((doc) => ({
      updateOne: {
        filter: { sourceKey: doc.sourceKey },
        update: {
          $set: {
            source: doc.source,
            sourceId: doc.sourceId,
            name: doc.name,
            normalizedName: doc.normalizedName,
            rating: doc.rating,
            address: doc.address,
            phone: doc.phone,
            types: doc.types,
            qualityVersion: HOSPITAL_CACHE_QUALITY_VERSION,
            location: { type: 'Point', coordinates: [doc.lng, doc.lat] },
            lastSeenAt: new Date()
          }
        },
        upsert: true
      }
    }));

  if (!operations.length) return;

  try {
    await Hospital.bulkWrite(operations, { ordered: false });
  } catch {
    // Cache writes should never block emergency recommendations.
  }
}

async function fetchOsmHospitalDocuments(lat, lng, radiusKm) {
  const radiusMeters = Math.round(radiusKm * 1000);
  const hospitalQuery = `
    [out:json][timeout:25];
    (
      nwr(around:${radiusMeters},${lat},${lng})["amenity"="hospital"];
      nwr(around:${radiusMeters},${lat},${lng})["healthcare"="hospital"];
      nwr(around:${radiusMeters},${lat},${lng})["emergency"="yes"];
    );
    out center tags 250;
  `;

  const hospitalData = await fetchOverpassJson(hospitalQuery);
  const hospitalDocs = (hospitalData?.elements || []).map(osmElementToHospitalDocument).filter(Boolean);
  if (hospitalDocs.length >= getMinHospitalResults()) return hospitalDocs;

  const clinicFallbackQuery = `
    [out:json][timeout:25];
    (
      nwr(around:${radiusMeters},${lat},${lng})["amenity"="clinic"];
      nwr(around:${radiusMeters},${lat},${lng})["healthcare"="clinic"];
      nwr(around:${radiusMeters},${lat},${lng})["amenity"="doctors"];
      nwr(around:${radiusMeters},${lat},${lng})["healthcare"="doctor"];
    );
    out center tags 120;
  `;

  const clinicData = await fetchOverpassJson(clinicFallbackQuery);
  const clinicDocs = (clinicData?.elements || []).map(osmElementToHospitalDocument).filter(Boolean);
  return [...hospitalDocs, ...clinicDocs];
}

async function fetchLiveHospitalDocuments(lat, lng, provider, department) {
  if (provider === 'google') {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return [];
    const places = await fetchGoogleHospitalCandidates(key, lat, lng);
    return places.map(googlePlaceToHospitalDocument).filter(Boolean);
  }

  return fetchOsmHospitalDocuments(lat, lng, getHospitalSearchRadiusKm());
}

async function buildHospitalResponse(candidates, { lat, lng, department, severity, limit, source }) {
  const usableCandidates = dedupeHospitals(candidates).filter((candidate) => getFacilityKind(candidate) !== 'excluded');
  const hospitalCandidates = usableCandidates.filter((candidate) => getFacilityKind(candidate) === 'hospital');
  const backupCandidates = usableCandidates.filter((candidate) => getFacilityKind(candidate) !== 'hospital');
  const minHospitalResults = Math.min(getMinHospitalResults(), limit);
  const candidatePool =
    hospitalCandidates.length >= minHospitalResults
      ? hospitalCandidates
      : [...hospitalCandidates, ...backupCandidates];

  const rankedCandidates = candidatePool
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(limit, 35));

  if (!rankedCandidates.length) {
    return fallbackHospitals(lat, lng, department, severity);
  }

  await Promise.all(
    rankedCandidates.map(async (hospital) => {
      hospital.etaMinutes = await getRouteEtaMinutes(lat, lng, hospital.lat, hospital.lng, hospital.etaMinutes);
    })
  );

  for (const hospital of rankedCandidates) {
    hospital.emergencySuitability = emergencyScore(hospital, severity, department);
  }

  rankedCandidates.sort(
    (a, b) =>
      facilitySortRank(b) - facilitySortRank(a) ||
      b.emergencySuitability - a.emergencySuitability
  );
  const hospitals = rankedCandidates.slice(0, limit).map(({ sourceKey: _sourceKey, source: _source, types: _types, ...rest }) => rest);

  return {
    bestHospitalId: hospitals[0]?.id || '',
    hospitals,
    isFallback: false,
    source
  };
}

export async function recommendHospitals({ lat, lng, department, severity }) {
  if (!validLatLng(lat, lng)) {
    return fallbackHospitals(28.6139, 77.209, department, severity);
  }

  const limit = getHospitalResultLimit();
  const radiusKm = getHospitalSearchRadiusKm();
  const minCachedHospitals = Math.min(getMinCachedHospitals(), limit);
  const provider = getHospitalProvider();
  const cacheLimit = Math.max(limit, 50);

  const cachedCandidates = await getCachedHospitalCandidates(lat, lng, department, radiusKm, cacheLimit);
  const cacheHasEnoughHospitals = countHospitalLike(cachedCandidates) >= minCachedHospitals;
  const cacheHasDepartmentMatch = !hasSpecializedDepartment(department) || countDepartmentMatches(cachedCandidates, department) > 0;
  if (cacheHasEnoughHospitals && cacheHasDepartmentMatch) {
    return buildHospitalResponse(cachedCandidates, {
      lat,
      lng,
      department,
      severity,
      limit,
      source: 'cache'
    });
  }

  try {
    const liveDocuments = await fetchLiveHospitalDocuments(lat, lng, provider, department);
    if (liveDocuments.length) {
      await upsertHospitalDocuments(liveDocuments);
      const liveCandidates = liveDocuments.map((doc) => liveDocumentToCandidate(doc, lat, lng, department));
      return buildHospitalResponse([...liveCandidates, ...cachedCandidates], {
        lat,
        lng,
        department,
        severity,
        limit,
        source: provider
      });
    }
  } catch {
    // If live fetching fails, stale-but-nearby cache is still better than sample data.
  }

  if (cachedCandidates.length) {
    return buildHospitalResponse(cachedCandidates, {
      lat,
      lng,
      department,
      severity,
      limit,
      source: 'cache'
    });
  }

  return fallbackHospitals(lat, lng, department, severity);
}
