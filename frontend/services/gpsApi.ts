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
 * tz를 미리 동봉한다 — 백엔드가 아직 안 받지만 조용히 버려질 뿐이고,
 * 받기 시작하면 앱 재배포 없이 켜진다 (앱 배포는 심사 때문에 느리다).
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
 * 기본 15초로는 모자란다 — 서버가 AI 호출에만 30초를 쓴다(`services/ai.py`).
 * 짧게 끊으면 서버는 저장했는데 앱은 실패로 알아 화면 갱신을 태우지 않는다.
 */
const ANALYZE_TIMEOUT_MS = 40000;

/**
 * POST /api/v1/gps/logs/{date}/analyze — 쌓인 로그를 체류 장소로 분석·저장.
 * tz는 하루 경계 계산에 필요하다 (모르는 쿼리는 FastAPI가 무시한다).
 */
export async function analyzeGpsLogs(date: string): Promise<AnalyzeResponse> {
  const {data} = await api.post<AnalyzeResponse>(
    `/api/v1/gps/logs/${date}/analyze`,
    undefined,
    {params: {timezone: getDeviceTimeZone()}, timeout: ANALYZE_TIMEOUT_MS},
  );
  return data;
}
