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
