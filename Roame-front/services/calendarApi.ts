/**
 * @file services/calendarApi.ts
 * @description 캘린더 관련 API 호출 및 타입 정의
 */

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
  arrived_at: string;    // ISO 8601
  left_at: string;       // ISO 8601
  lat: number;
  lng: number;
};

export type TimelineData = {
  date: string;          // 'YYYY-MM-DD'
  total_distance: number;
  polyline: {lat: number; lng: number}[];
  places: TimelinePlace[];
};

/** GET /api/v1/calendar/{year}/{month} */
export async function fetchCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarMonth> {
  const {data} = await api.get<CalendarMonth>(`/api/v1/calendar/${year}/${month}`);
  return data;
}

/** GET /api/v1/calendar/{date}/timeline */
export async function fetchTimeline(date: string): Promise<TimelineData> {
  const {data} = await api.get<TimelineData>(`/api/v1/calendar/${date}/timeline`);
  return data;
}
