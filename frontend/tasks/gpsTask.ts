import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs} from '@/services/gpsApi';
import {analyzePeriodically} from '@/utils/analyzeSchedule';
import {getCurrentUserId} from '@/utils/currentUser';
import {queueAndUploadGpsLogs} from '@/utils/gpsQueue';

export const GPS_TASK_NAME = 'roame-gps-task';

TaskManager.defineTask(
  GPS_TASK_NAME,
  async ({data, error}: TaskManager.TaskManagerTaskBody) => {
    if (error || !data) return;
    const {locations} = data as {locations: Location.LocationObject[]};
    const logs = locations.map(loc => ({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 0,
      speed: loc.coords.speed ?? 0,
      timestamp: new Date(loc.timestamp).toISOString(),
    }));

    // 토큰이 없다는 뜻이라 어차피 올릴 수 없다 (로그아웃 상태)
    const ownerId = await getCurrentUserId();
    if (!ownerId) return;

    // 밀린 것까지 같이 올라간다 — 실패하면 큐에 남아 다음 배치에서 재시도된다
    if (!(await queueAndUploadGpsLogs(ownerId, logs, uploadGpsLogs))) return;

    // 1시간에 한 번 — 그 날짜 전체를 다시 계산하는 무거운 호출이다
    await analyzePeriodically();
  },
);
