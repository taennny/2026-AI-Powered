import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs, analyzeGpsLogs} from '@/services/gpsApi';

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
  try {
    await uploadGpsLogs(logs);

    // 업로드 성공 시, 해당 로그가 기록된 날짜(UTC 기준)로 분석을 트리거해
    // 체류 장소를 즉시 타임라인에 반영한다. (백엔드 analyze는 UTC 날짜로 로그를 조회)
    const latestTimestamp = logs[logs.length - 1]?.timestamp;
    if (latestTimestamp) {
      const dateKey = new Date(latestTimestamp).toISOString().slice(0, 10);
      await analyzeGpsLogs(dateKey);
    }
  } catch {
    // 업로드/분석 실패는 조용히 무시 — 다음 배치에서 다시 시도된다.
  }
});
