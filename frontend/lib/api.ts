import { AnalysisResult, HospitalRecommendationResponse } from '@/types';
import type { Lang } from '@/contexts/LanguageContext';

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';
const normalizedApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');
const API_BASE_URL = normalizedApiBaseUrl.endsWith('/api')
  ? normalizedApiBaseUrl
  : `${normalizedApiBaseUrl}/api`;

async function apiRequest<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`API request failed: ${res.status}`);
  }

  return res.json();
}

export async function analyzeSymptoms(payload: {
  text: string;
  language: Lang;
}): Promise<AnalysisResult> {
  return apiRequest<AnalysisResult>('/analyze/symptoms', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function analyzeReports(payload: {
  files: { name: string; type: string; base64: string }[];
  language?: Lang;
  symptomContext?: string;
}): Promise<{ summary: string; redFlags: string[]; specialist: string }> {
  return apiRequest('/analyze/reports', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getHospitalRecommendations(payload: {
  lat: number;
  lng: number;
  department: string;
  severity: string;
}): Promise<HospitalRecommendationResponse> {
  return apiRequest('/hospitals/recommend', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
