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

// 달력이 항상 6줄로 고정됨을 가정: paddingTop(20) + 월헤더(48) + 요일레이블(23) + 6주×52.5px(315) = 406
const CALENDAR_HEIGHT_6_ROWS = 440;

export default function HomeIndex() {
  const [peekHeight, setPeekHeight] = useState(0);
  const {selectedDate, setSelectedDate, viewDate, setViewDate, calendarDays, places} =
    useCalendar();

  return (
    <View
      className="flex-1 bg-white"
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
