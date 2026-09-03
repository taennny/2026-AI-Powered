import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs} from '@/services/gpsApi';
import {analyzePeriodically} from '@/utils/analyzeSchedule';

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
    try {
      // 매 배치(30초)마다 — 가벼운 호출이고 자주 보내야 궤적이 촘촘하다
      await uploadGpsLogs(logs);
    } catch {
      // 실패는 무시 — 다음 배치에서 재시도된다
      return;
    }

    // 1시간에 한 번 — 그 날짜 전체를 다시 계산하는 무거운 호출이다
    await analyzePeriodically();
  },
);
