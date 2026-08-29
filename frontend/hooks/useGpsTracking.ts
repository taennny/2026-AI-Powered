import {Platform} from 'react-native';
import * as Location from 'expo-location';

import {GPS_TASK_NAME} from '@/tasks/gpsTask';

const INTERVAL_MS = 30_000;

export async function startGpsTracking() {
  // 웹에는 백그라운드 위치 태스크가 없다 — Expo 웹으로 열었을 때 크래시 방지
  if (Platform.OS === 'web') return;

  const {status: fg} = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') return;

  // 걷기 기록은 앱을 닫아도 이어져야 한다 — 백그라운드 권한이 없으면 시작하지 않는다.
  // 권한은 usePermissions가 받아내고, 나중에 설정에서 허용해도 AppState 복귀 때 살아난다.
  const {status: bg} = await Location.getBackgroundPermissionsAsync();
  if (bg !== 'granted') return;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(
    GPS_TASK_NAME,
  ).catch(() => false);
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
}

export async function stopGpsTracking() {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(
    GPS_TASK_NAME,
  ).catch(() => false);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
  }
}

export function useGpsTracking() {
  return {start: startGpsTracking, stop: stopGpsTracking};
}
