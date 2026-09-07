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

  timezone?: string | null;

  utc_offset_minutes?: number | null;
  photos?: string[]; // 원본 url — 확대 보기용

  thumbnails?: string[];
};

export type TimelineData = {
  date: string; // 'YYYY-MM-DD'
  polyline: {lat: number; lng: number}[];
  places: TimelinePlace[];

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
