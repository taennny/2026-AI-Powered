import {api} from '@/utils/api';

export type GpsLog = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  /** ISO 8601 UTC 문자열 (`2026-08-01T04:00:00.000Z`) */
  timestamp: string;
};

export async function uploadGpsLogs(logs: GpsLog[]): Promise<void> {
  await api.post('/api/v1/gps/logs', {logs});
}

export type AnalyzeResponse = {
  /** 분석으로 생성·갱신된 그날의 daily_record id (로그가 없으면 null) */
  daily_record_id: string | null;
  message: string;
  place_count: number;
};

/** POST /api/v1/gps/logs/{date}/analyze — 쌓인 로그를 체류 장소로 분석·저장 */
export async function analyzeGpsLogs(date: string): Promise<AnalyzeResponse> {
  const {data} = await api.post<AnalyzeResponse>(
    `/api/v1/gps/logs/${date}/analyze`,
  );
  return data;
}
