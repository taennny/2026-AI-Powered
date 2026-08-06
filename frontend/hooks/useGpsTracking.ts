import {Platform} from 'react-native';
import * as Location from 'expo-location';

import {GPS_TASK_NAME} from '@/tasks/gpsTask';

const INTERVAL_MS = 30_000;
const BG_GPS_ENABLED = process.env.EXPO_PUBLIC_BG_GPS !== 'false';

export async function startGpsTracking() {
  // 웹에는 백그라운드 위치 태스크가 없다 — Expo 웹으로 열었을 때 크래시 방지
  if (Platform.OS === 'web') return;

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
}

export async function stopGpsTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
}

export function useGpsTracking() {
  return {start: startGpsTracking, stop: stopGpsTracking};
}
