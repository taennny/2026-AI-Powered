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
    // 조회 키는 KST 기준으로 보낸다 — analyze가 daily_records.target_date를
    // KST 날짜로 기록하므로, 기기 타임존이 달라도 같은 하루를 가리키게 된다.
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

  // 월 변경 / 날짜 선택 / 강제 재조회(refreshKey) 시 다시 불러온다.
  useEffect(() => {
    loadCalendar();
  }, [loadCalendar, refreshKey]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline, refreshKey]);

  // 앱이 백그라운드에서 돌아오면 그 사이 쌓인 기록을 반영한다.
  // (화면 재마운트가 아니라 상태가 유지되므로 위 effect들은 다시 돌지 않는다)
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
