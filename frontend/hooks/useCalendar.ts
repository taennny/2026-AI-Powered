import {useState, useEffect, useCallback} from 'react';
import {AppState} from 'react-native';

import {
  fetchCalendarMonth,
  fetchTimeline,
  type CalendarDay,
  type TimelinePlace,
} from '@/services/calendarApi';
import {useTimelineStore} from '@/store/timelineStore';
import {toKstDateKey} from '@/utils/formatDate';

export function useCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [places, setPlaces] = useState<TimelinePlace[]>([]);
  const setTimeline = useTimelineStore(s => s.setTimeline);
  const refreshKey = useTimelineStore(s => s.refreshKey);

  const loadCalendar = useCallback(() => {
    fetchCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)
      .then(data => setCalendarDays(data.days))
      .catch(() => setCalendarDays([]));
  }, [viewDate]);

  const loadTimeline = useCallback(() => {
    // 조회 키는 KST — analyze가 target_date를 KST 날짜로 기록한다
    fetchTimeline(toKstDateKey(selectedDate))
      .then(data => {
        setPlaces(data.places);
        setTimeline(data.places.length);
      })
      .catch(() => {
        setPlaces([]);
        setTimeline(0);
      });
  }, [selectedDate, setTimeline]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar, refreshKey]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline, refreshKey]);

  // 백그라운드 복귀 시 그사이 쌓인 기록 반영 (재마운트가 없어 위 effect는 안 돈다)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        loadCalendar();
        loadTimeline();
      }
    });

    return () => subscription.remove();
  }, [loadCalendar, loadTimeline]);

  return {
    selectedDate,
    setSelectedDate,
    viewDate,
    setViewDate,
    calendarDays,
    places,
  };
}
