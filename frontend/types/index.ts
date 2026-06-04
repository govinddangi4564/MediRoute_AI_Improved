export type Severity = 'low' | 'moderate' | 'high' | 'critical';

export interface PatientProfile {
  age?: number;
  gender?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  pregnancyStatus?: string;
  emergencyContact?: string;
}

export interface AnalysisResult {
  severity: Severity;
  emergencyLevel: string;
  possibleDisease: string;
  confidenceScore: number;
  explanation: string;
  recommendations: string[];
  firstAid: string[];
  department: string;
  patientId?: string;
  followUpQuestions?: string[];
  riskTimeline?: string[];
  escalationTriggers?: string[];
  handoffSummary?: string;
  profile?: PatientProfile;
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
  capabilities?: string[];
  matchReason?: string;
}

export interface HospitalRecommendationResponse {
  bestHospitalId: string;
  hospitals: HospitalRecommendation[];
  isFallback?: boolean;
  source?: 'google' | 'osm' | 'cache' | 'fallback';
}
