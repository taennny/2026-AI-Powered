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

    // 업로드 성공 시, 해당 로그가 기록된 날짜로 분석을 트리거해
    // 체류 장소를 즉시 타임라인에 반영한다.
    // 백엔드 analyze는 날짜 경계를 KST로 해석하므로 UTC(toISOString)가 아닌
    // KST 달력 날짜를 보낸다. — 00~09시 KST 구간이 전날로 밀리는 문제 방지
    // (시뮬레이터 타임존이 KST가 아닐 수 있어 기기 로컬이 아닌 KST로 고정)
    //
    // 배치가 자정을 걸치면 한 배치에 여러 날짜의 로그가 섞여 들어온다.
    // 마지막 1건의 날짜만 분석하면 앞 날짜는 저장만 되고 분석되지 않으므로,
    // 배치에 포함된 KST 날짜 전부에 대해 분석을 요청한다.
    const dateKeys = [
      ...new Set(logs.map(log => toKstDateKey(new Date(log.timestamp)))),
    ].sort();

    for (const dateKey of dateKeys) {
      try {
        const {daily_record_id} = await analyzeGpsLogs(dateKey);

        // 글쓰기 화면이 요구하는 daily_record_id를 스토어에 보관한다.
        // 오름차순이라 마지막 반복이 최신 날짜 — 스토어에는 최신 것이 남는다.
        if (daily_record_id) {
          useTimelineStore.getState().setDailyRecordId(daily_record_id);
        }
      } catch {
        // 한 날짜가 실패해도 나머지 날짜는 계속 분석한다.
      }
    }
  } catch {
    // 업로드/분석 실패는 조용히 무시 — 다음 배치에서 다시 시도된다.
  }
});
