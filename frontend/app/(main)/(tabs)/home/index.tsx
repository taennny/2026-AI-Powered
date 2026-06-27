/**
 * @file app/(main)/(tabs)/home/index.tsx
 * @description 홈 인덱스 화면
 * - 배경: Calendar 컴포넌트
 * - 전경: BottomSheet 컴포넌트 (드래그로 peek ↔ expanded 전환)
 */

import {useState} from 'react';
import {View} from 'react-native';

import BottomSheet from '@/components/bottomsheet/BottomSheet';
import Calendar from '@/components/home/Calendar';
import {useCalendar} from '@/hooks/useCalendar';

export default function HomeIndex() {
  // 달력 실제 렌더 높이를 측정 — 5/6줄·이벤트 dot에 따라 높이가 달라지므로 고정값 대신 측정값 사용
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  const {selectedDate, setSelectedDate, viewDate, setViewDate, calendarDays, places} =
    useCalendar();

  // peek 시 보이는 시트 높이 = 전체 - 달력 높이 → 시트 상단이 달력 바로 아래에 위치
  const peekHeight =
    containerHeight !== null && calendarHeight !== null
      ? Math.max(0, containerHeight - calendarHeight)
      : null;

  return (
    <View
      className="flex-1 bg-card"
      onLayout={e => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <View onLayout={e => setCalendarHeight(e.nativeEvent.layout.height)}>
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          viewDate={viewDate}
          onViewDateChange={setViewDate}
          eventDays={calendarDays}
        />
      </View>

      {/* peekHeight 확정 후 렌더링 — 0이면 초기 위치 오류 방지 */}
      {peekHeight !== null && (
        <BottomSheet
          selectedDate={selectedDate}
          peekHeight={peekHeight}
          places={places}
        />
      )}
    </View>
  );
}
