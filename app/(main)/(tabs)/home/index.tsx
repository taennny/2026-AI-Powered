/**
 * @file app/(main)/(tabs)/home/index.tsx
 * @description 홈 인덱스 화면
 * - 배경: Calendar 컴포넌트
 * - 전경: BottomSheet 컴포넌트 (드래그로 peek ↔ expanded 전환)
 *
 * ## 다음 연결 작업
 * - [ ] eventDates: 날짜별 이벤트 API 연동 후 Calendar에 전달
 * - [ ] selectedDate 상태를 zustand store로 전환 검토 (타 화면 공유 필요 시)
 */

import {useState} from 'react';
import {View} from 'react-native';

import BottomSheet from '@/components/bottomsheet/BottomSheet';
import Calendar from '@/components/home/Calendar';
import {DUMMY_POSTS} from '@/constants/dummyData';

export default function HomeIndex() {
  // TODO: 추후 zustand store로 전환 검토
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // TODO: 실제 API 데이터로 교체
  const eventDates = DUMMY_POSTS.map(p => new Date(p.date));

  // 달력이 항상 6줄로 고정됨을 가정: paddingTop(20) + 월헤더(48) + 요일레이블(23) + 6주×52.5px(315) = 406
  const CALENDAR_HEIGHT_6_ROWS = 440;

  const [peekHeight, setPeekHeight] = useState(0);

  return (
    <View
      style={{flex: 1, backgroundColor: '#FFFFFF'}}
      onLayout={e =>
        setPeekHeight(e.nativeEvent.layout.height - CALENDAR_HEIGHT_6_ROWS)
      }
    >
      <Calendar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        eventDates={eventDates}
      />

      {/* peekHeight 확정 후 렌더링 — 0이면 초기 위치 오류 방지 */}
      {peekHeight > 0 && (
        <BottomSheet selectedDate={selectedDate} peekHeight={peekHeight} />
      )}
    </View>
  );
}
