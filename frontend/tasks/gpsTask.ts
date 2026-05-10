import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs} from '@/services/gpsApi';

export const GPS_TASK_NAME = 'roame-gps-task';

TaskManager.defineTask(GPS_TASK_NAME, async ({data, error}: TaskManager.TaskManagerTaskBody) => {
  if (error || !data) return;
  const {locations} = data as {locations: Location.LocationObject[]};
  const logs = locations.map(loc => ({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp,
  }));
  await uploadGpsLogs(logs).catch(() => {});
});
