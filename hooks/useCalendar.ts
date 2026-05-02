/**
 * @file hooks/useCalendar.ts
 * @description 캘린더 데이터 및 타임라인 fetch 로직
 * - viewDate 변경 시 해당 월 캘린더 데이터 fetch
 * - selectedDate 변경 시 해당 날짜 타임라인 fetch
 */

import {useState, useEffect} from 'react';
import {
  fetchCalendarMonth,
  fetchTimeline,
  type CalendarDay,
  type TimelinePlace,
} from '@/services/calendarApi';
import {useTimelineStore} from '@/store/timelineStore';
import {toDateKey} from '@/utils/formatDate';

export function useCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [places, setPlaces] = useState<TimelinePlace[]>([]);
  const setTotalDistance = useTimelineStore(s => s.setTotalDistance);

  // 월 이동 시 캘린더 데이터 fetch
  useEffect(() => {
    fetchCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)
      .then(data => setCalendarDays(data.days))
      .catch(() => setCalendarDays([]));
  }, [viewDate]);

  // 날짜 선택 시 타임라인 fetch
  useEffect(() => {
    fetchTimeline(toDateKey(selectedDate))
      .then(data => {
        setPlaces(data.places);
        setTotalDistance(data.total_distance);
      })
      .catch(() => {
        setPlaces([]);
        setTotalDistance(0);
      });
  }, [selectedDate]);

  return {
    selectedDate,
    setSelectedDate,
    viewDate,
    setViewDate,
    calendarDays,
    places,
  };
}
