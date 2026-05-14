import * as Location from 'expo-location';

import {GPS_TASK_NAME} from '@/tasks/gpsTask';

const INTERVAL_MS = 30_000;
const BG_GPS_ENABLED = process.env.EXPO_PUBLIC_BG_GPS !== 'false';

export function useGpsTracking() {
  const start = async () => {
    const {status: fg} = await Location.getForegroundPermissionsAsync();
    if (fg !== 'granted') return;

    if (BG_GPS_ENABLED) {
      const {status: bg} = await Location.getBackgroundPermissionsAsync();
      if (bg !== 'granted') return;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME).catch(() => false);
    if (isRunning) return;

    await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: INTERVAL_MS,
      distanceInterval: 0,
      ...(BG_GPS_ENABLED && {
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Roame',
          notificationBody: '위치를 기록하고 있어요.',
          notificationColor: '#7BBFD4',
        },
      }),
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
