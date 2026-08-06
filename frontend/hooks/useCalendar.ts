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
 * 마지막으로 성공한 조회 결과를 모듈에 남긴다.
 *
 * 탭 레이아웃이 `Slot`이라 홈↔저널을 오갈 때마다 화면이 통째로 언마운트된다.
 * 캐시가 없으면 돌아올 때마다 빈 화면을 보다가 네트워크가 끝나야 채워진다.
 * 캐시를 초기값으로 깔아 즉시 보여주고, 갱신은 뒤에서 진행한다.
 *
 * 키가 다르면(다른 달·다른 날짜) 쓰지 않는다 — 엉뚱한 날짜의 기록을 보여주면 안 된다.
 * 로그아웃 시 `(main)/_layout`이 비운다 — 다음 계정이 물려받으면 안 된다.
 */
let cachedMonth: {key: string; days: CalendarDay[]} | null = null;
let cachedTimeline: {key: string; places: TimelinePlace[]} | null = null;

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

export function clearCalendarCache(): void {
  cachedMonth = null;
  cachedTimeline = null;
}

export function useCalendar() {
  // 새벽 4시 이전이면 아직 '어제'다 — 자정 넘겨 앱을 열었을 때
  // 기록이 없는 새 날짜가 선택되는 것을 막는다
  const [selectedDate, setSelectedDate] = useState<Date>(logicalToday);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = logicalToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(() =>
    cachedMonth?.key === monthKey(viewDate) ? cachedMonth.days : [],
  );
  const [places, setPlaces] = useState<TimelinePlace[]>(() =>
    cachedTimeline?.key === toDateKey(selectedDate) ? cachedTimeline.places : [],
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
        // 실패한 결과를 캐시에 남기면 다음 진입에서 옛 데이터가 되살아난다
        if (cachedMonth?.key === key) cachedMonth = null;
        setCalendarDays([]);
      });
  }, [viewDate]);

  const loadTimeline = useCallback(() => {
    // selectedDate는 이미 '며칠'이 정해진 달력 날짜다 — 경계 보정을 다시 하면 안 된다
    const key = toDateKey(selectedDate);
    fetchTimeline(key)
      .then(data => {
        cachedTimeline = {key, places: data.places};
        setPlaces(data.places);
        setTimeline(data.places.length);

        // 백엔드가 아직 안 주면 undefined — 그때는 analyze 응답으로 채워진 값을
        // 그대로 둔다. 내려주기 시작하면 선택한 날짜의 id로 자동 교체된다.
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

  /**
   * 고른 날짜의 사진을 올린다 — 보는 날짜만 채우는 구조라 과거도 열면 채워진다.
   *
   * 오늘은 `usePhotoSync`가 앱 진입·복귀 때 이미 올리지만, 5분 간격 가드를
   * 공유하므로 중복 업로드는 일어나지 않는다.
   */
  useEffect(() => {
    let cancelled = false;

    syncPhotosForDate(toDateKey(selectedDate)).then(uploaded => {
      // 올린 게 있을 때만 다시 받는다 — 방금 올린 사진이 카드에 붙도록
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
