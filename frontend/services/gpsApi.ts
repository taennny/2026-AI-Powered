import {api} from '@/utils/api';

export type GpsLog = {
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  /**
   * ISO 8601 UTC 문자열 (`2026-08-01T04:00:00.000Z`).
   * epoch 숫자로 보내면 백엔드 pydantic이 "초 단위" 기본 규칙 대신
   * "200억 초과면 밀리초"라는 내부 휴리스틱으로 해석해야 파싱이 맞는다 —
   * 라이브러리 구현에 기대는 암묵적 계약이라 문자열로 명시한다.
   */
  timestamp: string;
};

export async function uploadGpsLogs(logs: GpsLog[]): Promise<void> {
  await api.post('/api/v1/gps/logs', {logs});
}

export type AnalyzeResponse = {
  /** 분석으로 생성·갱신된 그날의 daily_record id (로그가 없으면 null) */
  daily_record_id: string | null;
  message: string;
  place_count: number;
};

/** POST /api/v1/gps/logs/{date}/analyze — 쌓인 로그를 체류 장소로 분석·저장 */
export async function analyzeGpsLogs(date: string): Promise<AnalyzeResponse> {
  const {data} = await api.post<AnalyzeResponse>(
    `/api/v1/gps/logs/${date}/analyze`,
  );
  return data;
}
