import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs} from '@/services/gpsApi';

export const GPS_TASK_NAME = 'roame-gps-task';

TaskManager.defineTask(GPS_TASK_NAME, async ({data, error}: TaskManager.TaskManagerTaskBody) => {
  if (error || !data) return;
  const {locations} = data as {locations: Location.LocationObject[]};
  const logs = locations.map(loc => ({
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? 0,
    speed: loc.coords.speed ?? 0,
    timestamp: loc.timestamp,
  }));
  await uploadGpsLogs(logs).catch(() => {});
});
