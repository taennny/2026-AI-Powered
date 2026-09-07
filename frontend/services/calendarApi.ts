import {api} from '@/utils/api';

export type CalendarDay = {
  date: string; // 'YYYY-MM-DD'
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
  photos?: string[]; // 원본 url — 확대 보기용
  /**
   * 카드 썸네일용 축소본 url. 축소본이 없는 예전 사진에는 서버가 원본을 넣어 준다.
   * 옵셔널인 건 구버전 서버 대응 — 호출부가 `photos`로 폴백한다.
   */
  thumbnails?: string[];
};

export type TimelineData = {
  date: string; // 'YYYY-MM-DD'
  polyline: {lat: number; lng: number}[];
  places: TimelinePlace[];
  /**
   * 고른 날짜의 daily_record id. 글쓰기가 이 값을 쓴다 —
   * analyze 응답으로 받으면 항상 '오늘'이라 어제 카드에서 쓴 글이 오늘로 갔다.
   *
   * 옵셔널로 둔 건 구버전 서버 대응일 뿐이다(현재 서버는 항상 내려준다).
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
