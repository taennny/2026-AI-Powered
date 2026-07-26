import {api} from '@/utils/api';

export type GpsLog = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  timestamp: number;
};

export async function uploadGpsLogs(logs: GpsLog[]): Promise<void> {
  await api.post('/api/v1/gps/logs', {logs});
}

/** POST /api/v1/gps/logs/{date}/analyze — 쌓인 로그를 체류 장소로 분석·저장 */
export async function analyzeGpsLogs(date: string): Promise<void> {
  await api.post(`/api/v1/gps/logs/${date}/analyze`);
}
