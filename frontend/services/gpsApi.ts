import {api} from '@/utils/api';
import {getDeviceTimeZone} from '@/utils/timezone';

export type GpsLog = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  /** ISO 8601 UTC 문자열 (`2026-08-01T04:00:00.000Z`) */
  timestamp: string;
};

/**
 * 배치에 기기 tz를 동봉한다. 백엔드가 아직 안 받지만(pydantic 기본 extra='ignore')
 * 조용히 버려질 뿐이고, 받기 시작하면 앱 재배포 없이 켜진다.
 * 앱은 스토어 심사 때문에 배포가 느려서 미리 실어두는 편이 이득이다.
 */
export async function uploadGpsLogs(logs: GpsLog[]): Promise<void> {
  await api.post('/api/v1/gps/logs', {logs, timezone: getDeviceTimeZone()});
}

export type AnalyzeResponse = {
  /** 분석으로 생성·갱신된 그날의 daily_record id (로그가 없으면 null) */
  daily_record_id: string | null;
  message: string;
  place_count: number;
};

/**
 * POST /api/v1/gps/logs/{date}/analyze — 쌓인 로그를 체류 장소로 분석·저장
 *
 * tz는 쿼리 파라미터로 보낸다. 백엔드가 하루 경계를 계산할 때 필요하고,
 * 모르는 쿼리는 FastAPI가 무시하므로 지금 보내도 무해하다.
 */
export async function analyzeGpsLogs(date: string): Promise<AnalyzeResponse> {
  const {data} = await api.post<AnalyzeResponse>(
    `/api/v1/gps/logs/${date}/analyze`,
    undefined,
    {params: {timezone: getDeviceTimeZone()}},
  );
  return data;
}
