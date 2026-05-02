/**
 * @file components/home/Calendar.tsx
 * @description 홈 화면 월간 캘린더 컴포넌트
 * - 선택된 날짜만 하이라이트 (파란 원)
 * - has_journal: tealAccent dot / has_timeline: tealDark dot (최대 2개)
 * - viewDate는 부모에서 관리 (월 변경 시 API fetch 연동)
 *
 * - eventDays는 useCalendar 훅에서 fetchCalendarMonth 결과를 전달받음
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type CalendarDay} from '@/services/calendarApi';
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
  /** 현재 표시 중인 월 — 부모에서 관리 (월 변경 시 API fetch 연동) */
  viewDate: Date;
  /** 월 이동 시 호출 */
  onViewDateChange: (date: Date) => void;
  /** API에서 받은 날짜별 이벤트 정보 */
  eventDays?: CalendarDay[];
};

export default function Calendar({
  selectedDate,
  onDateSelect,
  viewDate,
  onViewDateChange,
  eventDays = [],
}: Props) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const goToPrevMonth = () =>
    onViewDateChange(new Date(year, month - 1, 1));

  const goToNextMonth = () =>
    onViewDateChange(new Date(year, month + 1, 1));

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

  const getEventDay = (day: number): CalendarDay | undefined => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventDays.find(d => d.date === key);
  };

  return (
    <View style={{backgroundColor: Colors.white, paddingHorizontal: 16, paddingTop: 20}}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 14}}>
        <TouchableOpacity onPress={goToPrevMonth} style={{paddingRight: 10}}>
          <Text style={{fontSize: 22, fontWeight: '500', color: Colors.teal}}>{'<'}</Text>
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
          <Text style={{fontSize: 22, fontWeight: '500', color: Colors.teal}}>{'>'}</Text>
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
          {week.map((day, di) => {
            const eventDay = day ? getEventDay(day) : undefined;
            const highlighted = !!day && isSelected(day);

            return (
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
                        backgroundColor: highlighted ? Colors.tealAccent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: highlighted ? '700' : '400',
                          color: highlighted ? Colors.white : Colors.textPrimary,
                        }}
                      >
                        {day}
                      </Text>
                    </View>

                    {/* 타임라인 있을 때만 dot 표시 — 타임라인만: 1개(tealAccent), 타임라인+일기: 2개 */}
                    {eventDay?.has_timeline && (
                      <View style={{flexDirection: 'row', gap: 3, marginTop: 3}}>
                        <View
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: Colors.tealAccent,
                          }}
                        />
                        {eventDay.has_journal && (
                          <View
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: Colors.tealDark,
                            }}
                          />
                        )}
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}
