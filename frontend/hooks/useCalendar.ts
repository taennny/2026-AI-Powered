/**
 * @file hooks/useCalendar.ts
 * @description 캘린더 데이터 및 타임라인 fetch 로직
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
  const setTimeline = useTimelineStore(s => s.setTimeline);

  useEffect(() => {
    fetchCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)
      .then(data => setCalendarDays(data.days))
      .catch(() => setCalendarDays([]));
  }, [viewDate]);

  useEffect(() => {
    fetchTimeline(toDateKey(selectedDate))
      .then(data => {
        setPlaces(data.places);
        setTimeline(data.places.length);
      })
      .catch(() => {
        setPlaces([]);
        setTimeline(0);
      });
  }, [selectedDate, setTimeline]);

  return {
    selectedDate,
    setSelectedDate,
    viewDate,
    setViewDate,
    calendarDays,
    places,
  };
}