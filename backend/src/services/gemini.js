function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
}

const languageNames = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi'
};

function summarizePatientProfile(profile = {}) {
  const items = [];
  if (profile.age) items.push(`Age: ${profile.age}`);
  if (profile.gender) items.push(`Gender: ${profile.gender}`);
  if (profile.conditions) items.push(`Known conditions: ${profile.conditions}`);
  if (profile.allergies) items.push(`Allergies: ${profile.allergies}`);
  if (profile.medications) items.push(`Current medicines: ${profile.medications}`);
  if (profile.pregnancyStatus) items.push(`Pregnancy status: ${profile.pregnancyStatus}`);
  if (profile.emergencyContact) items.push(`Emergency contact: ${profile.emergencyContact}`);
  return items.length ? items.join('\n') : 'No patient profile provided.';
}

function buildRiskTimeline(highRisk) {
  return highRisk
    ? [
        'Now: keep the patient resting and do not leave them alone.',
        'Within 5 minutes: call 112 if symptoms are severe or worsening.',
        'Within 20 minutes: move toward emergency care or wait for ambulance guidance.'
      ]
    : [
        'Now: rest, hydrate, and note the main symptoms.',
        'Next 2-3 hours: monitor temperature, pain, breathing, and weakness.',
        'Same day: consult a doctor if symptoms increase or new warning signs appear.'
      ];
}

function fallbackAnalysis(text, profile = {}) {
  const lower = text.toLowerCase();
  const criticalWords = ['chest pain', 'breath', 'unconscious', 'bleeding', 'stroke', 'seizure'];
  const highRisk = criticalWords.some((w) => lower.includes(w));
  const riskTimeline = buildRiskTimeline(highRisk);
  return {
    isFallback: true,
    severity: highRisk ? 'high' : 'moderate',
    emergencyLevel: highRisk ? 'Urgent' : 'Monitor Closely',
    possibleDisease: highRisk ? 'Cardio-respiratory emergency suspicion' : 'Viral or general systemic condition',
    confidenceScore: highRisk ? 86 : 68,
    explanation: 'This is an AI-assisted suggestion, not a final diagnosis. Please contact a doctor for confirmation.',
    recommendations: highRisk
      ? ['Go to nearest emergency hospital now.', 'Do not travel alone.', 'Keep emergency contact informed.']
      : ['Hydrate and rest.', 'Track symptoms every 2-3 hours.', 'Seek doctor visit if worsening.'],
    firstAid: highRisk
      ? ['Keep patient seated upright.', 'Loosen tight clothing.', 'If severe chest pain continues, call emergency services immediately.']
      : ['Drink fluids and take rest.', 'Use a thermometer to monitor fever.', 'Avoid self-medication without advice.'],
    department: highRisk ? 'Emergency Medicine' : 'General Medicine',
    followUpQuestions: highRisk
      ? ['When did the symptoms start?', 'Is there sweating, fainting, or blue lips?', 'Does the patient have diabetes, BP, asthma, or heart disease?']
      : ['How long have symptoms been present?', 'Is there fever, breathing difficulty, or severe pain?', 'Any medicine already taken?'],
    riskTimeline,
    handoffSummary: [
      `Symptoms: ${text}`,
      `Profile: ${summarizePatientProfile(profile).replace(/\n/g, '; ')}`,
      `Urgency: ${highRisk ? 'High risk - emergency evaluation advised' : 'Moderate risk - clinical review advised'}`,
      `Suggested department: ${highRisk ? 'Emergency Medicine' : 'General Medicine'}`
    ].join('\n'),
    escalationTriggers: highRisk
      ? ['Breathing difficulty', 'Loss of consciousness', 'Severe chest pain', 'Stroke signs', 'Heavy bleeding']
      : ['Worsening fever', 'Breathing difficulty', 'Confusion', 'Persistent vomiting', 'Severe pain']
  };
}

function safeJsonParse(rawText) {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    const fenced = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(fenced);
    } catch {
      return null;
    }
  }
}

function normalizeEmergencyNumber(value) {
  if (typeof value === 'string') {
    return value.replace(/\b911\b/g, '112');
  }

  if (Array.isArray(value)) {
    return value.map(normalizeEmergencyNumber);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeEmergencyNumber(entry)])
    );
  }

  return value;
}

async function callGeminiGenerate({ model, apiKey, body }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return response;
}

function normalizeAnalysis(parsed, text, profile) {
  const fallback = fallbackAnalysis(text, profile);
  const result = { ...fallback, ...parsed };
  const allowedSeverity = new Set(['low', 'moderate', 'high', 'critical']);
  if (!allowedSeverity.has(result.severity)) result.severity = fallback.severity;
  result.confidenceScore = Number.isFinite(Number(result.confidenceScore))
    ? Math.max(0, Math.min(100, Math.round(Number(result.confidenceScore))))
    : fallback.confidenceScore;
  result.recommendations = Array.isArray(result.recommendations) ? result.recommendations : fallback.recommendations;
  result.firstAid = Array.isArray(result.firstAid) ? result.firstAid : fallback.firstAid;
  result.followUpQuestions = Array.isArray(result.followUpQuestions) ? result.followUpQuestions : fallback.followUpQuestions;
  result.riskTimeline = Array.isArray(result.riskTimeline) ? result.riskTimeline : fallback.riskTimeline;
  result.escalationTriggers = Array.isArray(result.escalationTriggers) ? result.escalationTriggers : fallback.escalationTriggers;
  result.handoffSummary = result.handoffSummary || fallback.handoffSummary;
  return normalizeEmergencyNumber(result);
}

export async function analyzeWithGemini(text, language, profile = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return fallbackAnalysis(text, profile);
  }

  const requestedModel = getGeminiModel();
  const modelCandidates = Array.from(new Set([requestedModel, 'gemini-1.5-flash', 'gemini-1.5-pro']));
  const outputLanguage = languageNames[language] || 'English';
  const prompt = `You are a healthcare triage assistant for users in India. User language: ${outputLanguage}. Analyze the symptoms and patient profile. Return strict JSON keys: severity(low|moderate|high|critical), emergencyLevel, possibleDisease, confidenceScore(0-100), explanation(simple words), recommendations(array of short items), firstAid(array), department, followUpQuestions(array of 3-5 critical questions), riskTimeline(array of 3 time-based action steps), escalationTriggers(array), handoffSummary(one concise paragraph for ambulance or hospital staff). Use India's emergency number 112 whenever emergency calling is mentioned. Do not mention 911. Return all human-readable values in ${outputLanguage}. Keep severity as one of the required English enum values.`;
  const body = {
    contents: [{ parts: [{ text: `${prompt}\n\nPatient profile:\n${summarizePatientProfile(profile)}\n\nSymptoms: ${text}` }] }],
    generationConfig: { response_mime_type: 'application/json' }
  };

  for (const model of modelCandidates) {
    const response = await callGeminiGenerate({ model, apiKey, body });
    if (!response.ok) {
      if (response.status === 404 || response.status === 400) continue;
      const raw = await response.text();
      console.error(`[Gemini] symptom analysis failed for model=${model} status=${response.status} body=${raw}`);
      continue;
    }
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = safeJsonParse(rawText);
    if (parsed) return normalizeAnalysis(parsed, text, profile);
  }

  return fallbackAnalysis(text, profile);
}

export async function analyzeReportsWithGemini(files, language = 'en') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      isFallback: true,
      summary: 'Reports uploaded successfully. AI summary is available after Gemini key setup.',
      redFlags: ['Please verify abnormal values with your doctor.'],
      specialist: 'General Physician'
    };
  }

  const requestedModel = getGeminiModel();
  const modelCandidates = Array.from(new Set([requestedModel, 'gemini-1.5-flash', 'gemini-1.5-pro']));
  const outputLanguage = languageNames[language] || 'English';
  const prompt = `Summarize uploaded reports in simple language for a normal patient. Return strict JSON with keys summary, redFlags(array), specialist. Return all human-readable values in ${outputLanguage}.`;

  const contents = [{ parts: [{ text: prompt }] }];
  for (const f of files) {
    contents[0].parts.push({ inline_data: { mime_type: f.type || 'application/pdf', data: f.base64 } });
  }

  const body = { contents, generationConfig: { response_mime_type: 'application/json' } };
  for (const model of modelCandidates) {
    const response = await callGeminiGenerate({ model, apiKey, body });
    if (!response.ok) {
      if (response.status === 404 || response.status === 400) continue;
      const raw = await response.text();
      console.error(`[Gemini] report analysis failed for model=${model} status=${response.status} body=${raw}`);
      continue;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = safeJsonParse(rawText);
    if (parsed) return parsed;
    if (rawText) return { summary: rawText, redFlags: [], specialist: 'General Physician', isFallback: false };
  }

  return { summary: 'Could not analyze report right now.', redFlags: [], specialist: 'General Physician', isFallback: true };
}
