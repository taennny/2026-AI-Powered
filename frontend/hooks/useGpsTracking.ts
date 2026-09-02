import {Platform} from 'react-native';
import * as Location from 'expo-location';

import {GPS_TASK_NAME} from '@/tasks/gpsTask';

const INTERVAL_MS = 30_000;

/**
 * iOS는 `timeInterval`을 무시하고 거리로만 좌표를 준다 — Balanced(≈100m)로는
 * 연속한 두 점이 늘 STAY_RADIUS_M(50m)을 넘어 체류가 하나도 안 잡혔다.
 * 안드로이드는 `distanceInterval: 0` + 시간 기준이라 그대로 둔다.
 */
const TRACKING_OPTIONS =
  Platform.OS === 'ios'
    ? {accuracy: Location.Accuracy.High, distanceInterval: 10}
    : {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: INTERVAL_MS,
        distanceInterval: 0,
      };

/**
 * 시작·정지를 순서대로 실행한다 — 계정을 바꾸면 로그아웃의 정지와 로그인의 시작이
 * 겹쳐, 시작이 "이미 켜져 있음"으로 건너뛴 뒤 정지가 끝나면서 추적이 꺼진 채 남는다.
 */
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => {});
  return next;
}

export function startGpsTracking(): Promise<void> {
  return serialize(runStart);
}

export function stopGpsTracking(): Promise<void> {
  return serialize(runStop);
}

async function runStart() {
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
    ...TRACKING_OPTIONS,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Roame',
      notificationBody: '위치를 기록하고 있어요.',
      notificationColor: '#7BBFD4',
    },
  });
}

async function runStop() {
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
