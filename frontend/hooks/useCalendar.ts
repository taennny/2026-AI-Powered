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
import {syncPhotosForDate} from '@/utils/photoSync';

/**
 * 마지막 성공 결과를 모듈에 남긴다 — 탭 레이아웃이 `Slot`이라 홈↔저널을
 * 오갈 때마다 화면이 언마운트되기 때문이다. 갱신은 뒤에서 진행한다.
 *
 * 키가 다르면 쓰지 않는다. 로그아웃 시 `(main)/_layout`이 비운다.
 */
let cachedMonth: {key: string; days: CalendarDay[]} | null = null;
let cachedTimeline: {key: string; places: TimelinePlace[]} | null = null;

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

export function clearCalendarCache(): void {
  cachedMonth = null;
  cachedTimeline = null;
}

export function useCalendar() {
  // 새벽 4시 이전이면 아직 '어제' — 빈 날짜가 선택되는 것을 막는다
  const [selectedDate, setSelectedDate] = useState<Date>(logicalToday);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = logicalToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(() =>
    cachedMonth?.key === monthKey(viewDate) ? cachedMonth.days : [],
  );
  const [places, setPlaces] = useState<TimelinePlace[]>(() =>
    cachedTimeline?.key === toDateKey(selectedDate)
      ? cachedTimeline.places
      : [],
  );
  const setTimeline = useTimelineStore(s => s.setTimeline);
  const setDailyRecordId = useTimelineStore(s => s.setDailyRecordId);
  const refreshKey = useTimelineStore(s => s.refreshKey);

  const loadCalendar = useCallback(() => {
    const key = monthKey(viewDate);
    fetchCalendarMonth(viewDate.getFullYear(), viewDate.getMonth() + 1)
      .then(data => {
        cachedMonth = {key, days: data.days};
        setCalendarDays(data.days);
      })
      .catch(() => {
        // 실패를 캐시에 남기면 다음 진입에서 옛 데이터가 되살아난다
        if (cachedMonth?.key === key) cachedMonth = null;
        setCalendarDays([]);
      });
  }, [viewDate]);

  const loadTimeline = useCallback(() => {
    // 이미 '며칠'이 정해진 달력 날짜 — 경계 보정을 다시 하면 안 된다
    const key = toDateKey(selectedDate);
    fetchTimeline(key)
      .then(data => {
        cachedTimeline = {key, places: data.places};
        setPlaces(data.places);
        setTimeline(data.places.length);

        // 고른 날짜의 id로 덮어쓴다 — analyze가 채운 값은 항상 '오늘'이라
        // 어제 카드에서 글을 쓰면 오늘 기록으로 갔다.
        // undefined 가드는 구버전 서버 대응일 뿐이다
        if (data.daily_record_id !== undefined) {
          setDailyRecordId(data.daily_record_id);
        }
      })
      .catch(() => {
        if (cachedTimeline?.key === key) cachedTimeline = null;
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

  useEffect(() => {
    const dateKey = toDateKey(selectedDate);
    if (dateKey !== toDateKey(logicalToday())) return;

    let cancelled = false;

    syncPhotosForDate(dateKey).then(uploaded => {
      if (uploaded > 0 && !cancelled) loadTimeline();
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, loadTimeline]);

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
