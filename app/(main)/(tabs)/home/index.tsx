/**
 * @file app/(main)/(tabs)/home/index.tsx
 * @description 홈 인덱스 화면
 * - 배경: Calendar 컴포넌트
 * - 전경: BottomSheet 컴포넌트 (드래그로 peek ↔ expanded 전환)
 *
 * ## 다음 연결 작업
 * - [ ] selectedDate 상태를 zustand store로 전환 검토 (타 화면 공유 필요 시)
 */

import {useState, useEffect} from 'react';
import {View} from 'react-native';

import BottomSheet from '@/components/bottomsheet/BottomSheet';
import Calendar from '@/components/home/Calendar';
import {Colors} from '@/constants/Colors';
import {toDateKey} from '@/utils/formatDate';
import {
  fetchCalendarMonth,
  fetchTimeline,
  type CalendarDay,
  type TimelinePlace,
} from '@/services/calendarApi';
import {useTimelineStore} from '@/store/timelineStore';

// 달력이 항상 6줄로 고정됨을 가정: paddingTop(20) + 월헤더(48) + 요일레이블(23) + 6주×52.5px(315) = 406
const CALENDAR_HEIGHT_6_ROWS = 440;

export default function HomeIndex() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewDate, setViewDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [peekHeight, setPeekHeight] = useState(0);
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

  return (
    <View
      style={{flex: 1, backgroundColor: Colors.white}}
      onLayout={e =>
        setPeekHeight(e.nativeEvent.layout.height - CALENDAR_HEIGHT_6_ROWS)
      }
    >
      <Calendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        viewDate={viewDate}
        onViewDateChange={setViewDate}
        eventDays={calendarDays}
      />

      {/* peekHeight 확정 후 렌더링 — 0이면 초기 위치 오류 방지 */}
      {peekHeight > 0 && (
        <BottomSheet
          selectedDate={selectedDate}
          peekHeight={peekHeight}
          places={places}
        />
      )}
    </View>
  );
}
