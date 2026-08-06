import {api} from '@/utils/api';

export type CalendarDay = {
  date: string;          // 'YYYY-MM-DD'
  has_journal: boolean;
  has_timeline: boolean;
};

export type CalendarMonth = {
  year: number;
  month: number;
  days: CalendarDay[];
};

export type TimelinePlace = {
  place_id: string;
  name: string;
  category: string;
  arrived_at: string;
  left_at: string;
  lat: number;
  lng: number;
  photos?: string[];     // 촬영된 사진 url 목록
};

export type TimelineData = {
  date: string;          // 'YYYY-MM-DD'
  polyline: {lat: number; lng: number}[];
  places: TimelinePlace[];
  /**
   * 그 날짜의 daily_record id — **백엔드가 아직 안 내려줍니다(undefined).**
   *
   * 지금 `dailyRecordId`는 analyze 응답에서만 오는데, 그건 analyze가 돌린 날짜(오늘)라
   * 사용자가 캘린더에서 고른 날짜와 어긋납니다. 어제 카드를 보며 글쓰기를 누르면
   * 오늘 기록으로 글이 생성됩니다.
   *
   * 이 필드가 오기 시작하면 화면에 그려지는 타임라인과 **같은 응답·같은 날짜**에서
   * 오므로 어긋날 수가 없습니다. 미리 읽어두면 백엔드 배포만으로 켜집니다
   * (GPS `timezone` 전송과 같은 방식).
   */
  daily_record_id?: string | null;
};

/** GET /api/v1/calendar/{year}/{month} */
export async function fetchCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarMonth> {
  const {data} = await api.get<CalendarMonth>(
    `/api/v1/calendar/${year}/${month}`,
  );
  return data;
}

/** GET /api/v1/calendar/{date}/timeline */
export async function fetchTimeline(date: string): Promise<TimelineData> {
  const {data} = await api.get<TimelineData>(
    `/api/v1/calendar/${date}/timeline`,
  );
  return data;
}