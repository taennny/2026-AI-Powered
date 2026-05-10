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

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const MOCK_CALENDAR: CalendarMonth = {
  year: 2026,
  month: 5,
  days: [
    {date: '2026-05-07', has_journal: false, has_timeline: true},
  ],
};

const MOCK_TIMELINE: TimelineData = {
  date: '2026-05-07',
  total_distance: 0.68,
  polyline: [
    {lat: 37.5577, lng: 126.9250},
    {lat: 37.5565, lng: 126.9240},
    {lat: 37.5550, lng: 126.9235},
    {lat: 37.5538, lng: 126.9225},
    {lat: 37.5530, lng: 126.9220},
    {lat: 37.5518, lng: 126.9208},
  ],
  places: [
    {
      place_id: 'place_001',
      name: '앤트러사이트 홍대',
      category: '카페',
      arrived_at: '2026-05-07T09:02:00.000Z',
      left_at: '2026-05-07T09:30:00.000Z',
      lat: 37.5550,
      lng: 126.9235,
    },
    {
      place_id: 'place_002',
      name: '현대카드 뮤직라이브러리',
      category: '문화시설',
      arrived_at: '2026-05-07T09:31:30.000Z',
      left_at: '2026-05-07T11:00:00.000Z',
      lat: 37.5530,
      lng: 126.9220,
    },
    {
      place_id: 'place_003',
      name: '홍대 고기리막국수',
      category: '음식점',
      arrived_at: '2026-05-07T11:01:30.000Z',
      left_at: '2026-05-07T12:30:00.000Z',
      lat: 37.5518,
      lng: 126.9208,
    },
  ],
};

/** GET /api/v1/calendar/{year}/{month} */
export async function fetchCalendarMonth(
  year: number,
  month: number,
): Promise<CalendarMonth> {
  if (USE_MOCK) return MOCK_CALENDAR;
  const {data} = await api.get<CalendarMonth>(`/api/v1/calendar/${year}/${month}`);
  return data;
}

/** GET /api/v1/calendar/{date}/timeline */
export async function fetchTimeline(date: string): Promise<TimelineData> {
  if (USE_MOCK && date === '2026-05-07') return MOCK_TIMELINE;
  const {data} = await api.get<TimelineData>(`/api/v1/calendar/${date}/timeline`);
  return data;
}
