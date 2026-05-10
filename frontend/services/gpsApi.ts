import {api} from '@/utils/api';

export type GpsLog = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export async function uploadGpsLogs(logs: GpsLog[]): Promise<void> {
  await api.post('/api/v1/gps/logs', {logs});
}
