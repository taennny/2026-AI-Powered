import {useState, useEffect, useCallback} from 'react';
import {AppState} from 'react-native';

import {
  fetchCalendarMonth,
  fetchTimeline,
  type CalendarDay,
  type TimelinePlace,
} from '@/services/calendarApi';
import {useTimelineStore} from '@/store/timelineStore';
import {logicalToday, toDateKey} from '@/utils/formatDate';

export function useCalendar() {
  // 새벽 4시 이전이면 아직 '어제'다 — 자정 넘겨 앱을 열었을 때
  // 기록이 없는 새 날짜가 선택되는 것을 막는다
  const [selectedDate, setSelectedDate] = useState<Date>(logicalToday);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = logicalToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [places, setPlaces] = useState<TimelinePlace[]>([]);
  const setTimeline = useTimelineStore(s => s.setTimeline);
  const setDailyRecordId = useTimelineStore(s => s.setDailyRecordId);
  const refreshKey = useTimelineStore(s => s.refreshKey);

  const loadCalendar = useCallback(() => {
    fetchCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)
      .then(data => setCalendarDays(data.days))
      .catch(() => setCalendarDays([]));
  }, [viewDate]);

  const loadTimeline = useCallback(() => {
    // selectedDate는 이미 '며칠'이 정해진 달력 날짜다 — 경계 보정을 다시 하면 안 된다
    fetchTimeline(toDateKey(selectedDate))
      .then(data => {
        setPlaces(data.places);
        setTimeline(data.places.length);

        // 백엔드가 아직 안 주면 undefined — 그때는 analyze 응답으로 채워진 값을
        // 그대로 둔다. 내려주기 시작하면 선택한 날짜의 id로 자동 교체된다.
        if (data.daily_record_id !== undefined) {
          setDailyRecordId(data.daily_record_id);
        }
      })
      .catch(() => {
        setPlaces([]);
        setTimeline(0);
      });
  }, [selectedDate, setTimeline, setDailyRecordId]);

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
