/**
 * @file components/home/Calendar.tsx
 * @description 홈 화면 월간 캘린더 컴포넌트
 * - 현재 월 기준으로 날짜 그리드 렌더링
 * - 선택된 날짜만 하이라이트 (파란 원) — 초기값은 오늘, 다른 날 선택 시 오늘 강조 해제
 * - 이벤트가 있는 날짜에 점(dot) 표시
 *
 * ## 다음 연결 작업
 * - [ ] eventDates → 실제 API 응답 데이터로 교체
 * - [ ] viewDate 변경 시 해당 월 이벤트 데이터 fetch 연동
 */

import {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';

import {Colors} from '@/constants/Colors';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  /** 선택된 날짜 — 부모에서 관리 */
  selectedDate?: Date;
  /** 날짜 탭 시 호출 */
  onDateSelect?: (date: Date) => void;
  /** 이벤트 dot을 표시할 날짜 목록 */
  eventDates?: Date[];
};

export default function Calendar({
  selectedDate,
  onDateSelect,
  eventDates = [],
}: Props) {
  const today = new Date();

  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const goToPrevMonth = () =>
    setViewDate(new Date(year, month - 1, 1));

  const goToNextMonth = () =>
    setViewDate(new Date(year, month + 1, 1));

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = Array.from(
    {length: cells.length / 7},
    (_, i) => cells.slice(i * 7, i * 7 + 7),
  );

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isSelected = (day: number) =>
    !!selectedDate && isSameDay(new Date(year, month, day), selectedDate);

  const hasEvent = (day: number) =>
    eventDates.some(d => isSameDay(d, new Date(year, month, day)));

  const highlighted = (day: number) => isSelected(day);

  return (
    <View style={{backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 20}}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 14}}>
        <TouchableOpacity onPress={goToPrevMonth} style={{paddingRight: 10}}>
          <Text style={{fontSize: 14, fontWeight: '500', color: Colors.teal}}>{'<'}</Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 28,
            fontWeight: '800',
            color: Colors.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          {MONTH_NAMES[month]} {year}
        </Text>

        <TouchableOpacity onPress={goToNextMonth} style={{paddingLeft: 10}}>
          <Text style={{fontSize: 14, fontWeight: '500', color: Colors.teal}}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{flexDirection: 'row', marginBottom: 4}}>
        {DAY_LABELS.map(label => (
          <View key={label} style={{flex: 1, alignItems: 'center', paddingBottom: 6}}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '500',
                color: Colors.textTertiary,
                letterSpacing: 0.4,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View
          key={wi}
          style={{
            flexDirection: 'row',
            borderTopWidth: 0.5,
            borderTopColor: Colors.borderLight,
          }}
        >
          {week.map((day, di) => (
            <TouchableOpacity
              key={di}
              disabled={!day}
              onPress={() => day && onDateSelect?.(new Date(year, month, day))}
              style={{flex: 1, alignItems: 'center', paddingVertical: 10}}
            >
              {day !== null && (
                <>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: highlighted(day) ? Colors.tealAccent : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: highlighted(day) ? '700' : '400',
                        color: highlighted(day) ? Colors.white : Colors.textPrimary,
                      }}
                    >
                      {day}
                    </Text>
                  </View>

                  {hasEvent(day) && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: Colors.tealAccent,
                        marginTop: 3,
                      }}
                    />
                  )}
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}
