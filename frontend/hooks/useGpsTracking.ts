import * as Location from 'expo-location';

import {GPS_TASK_NAME} from '@/tasks/gpsTask';

const INTERVAL_MS = 30_000;

export function useGpsTracking() {
  const start = async () => {
    const {status: fg} = await Location.getForegroundPermissionsAsync();
    const {status: bg} = await Location.getBackgroundPermissionsAsync();
    if (fg !== 'granted' || bg !== 'granted') return;

    const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME).catch(() => false);
    if (isRunning) return;

    await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: INTERVAL_MS,
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Roame',
        notificationBody: '위치를 기록하고 있어요.',
        notificationColor: '#7BBFD4',
      },
    });
  };

  const stop = async () => {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
    }
  };

  return {start, stop};
}
