import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

import {uploadGpsLogs, analyzeGpsLogs} from '@/services/gpsApi';
import {useTimelineStore} from '@/store/timelineStore';
import {toKstDateKey} from '@/utils/formatDate';

export const GPS_TASK_NAME = 'roame-gps-task';

TaskManager.defineTask(GPS_TASK_NAME, async ({data, error}: TaskManager.TaskManagerTaskBody) => {
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
    await uploadGpsLogs(logs);

    // 백엔드 analyze는 날짜 경계를 KST로 해석한다.
    // 배치가 자정을 걸치면 여러 날짜가 섞이므로 포함된 날짜 전부를 분석한다.
    const dateKeys = [
      ...new Set(logs.map(log => toKstDateKey(new Date(log.timestamp)))),
    ].sort();

    for (const dateKey of dateKeys) {
      try {
        const {daily_record_id} = await analyzeGpsLogs(dateKey);

        if (daily_record_id) {
          useTimelineStore.getState().setDailyRecordId(daily_record_id);
        }
      } catch {
        // 한 날짜가 실패해도 나머지는 계속 분석한다
      }
    }
  } catch {
    // 실패는 무시 — 다음 배치에서 재시도된다
  }
});
