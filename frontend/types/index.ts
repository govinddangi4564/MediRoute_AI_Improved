export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface AnalysisResult {
  severity: Severity;
  emergencyLevel: string;
  possibleDisease: string;
  confidenceScore: number;
  explanation: string;
  recommendations: string[];
  firstAid: string[];
  department: string;
}

export interface HospitalRecommendation {
  id: string;
  name: string;
  rating: number;
  distanceKm: number;
  etaMinutes: number;
  address: string;
  phone?: string;
  specialization: string;
  emergencySuitability: number;
  lat: number;
  lng: number;
}

export interface HospitalRecommendationResponse {
  bestHospitalId: string;
  hospitals: HospitalRecommendation[];
  isFallback?: boolean;
  source?: 'google' | 'osm' | 'cache' | 'fallback';
}
