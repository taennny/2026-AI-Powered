/**
 * @file components/home/Calendar.tsx — 홈 화면 월간 캘린더
 * - 선택된 날짜만 하이라이트 (teal-accent 원)
 * - has_journal: tealAccent dot / has_timeline: tealDark dot (최대 2개)
 * - viewDate는 부모에서 관리 (월 변경 시 API fetch 연동 — useCalendar 훅)
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
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  viewDate: Date;
  onViewDateChange: (date: Date) => void;
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

  const goToPrevMonth = () => onViewDateChange(new Date(year, month - 1, 1));
  const goToNextMonth = () => onViewDateChange(new Date(year, month + 1, 1));

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
    <View className="bg-white px-4 pt-5">

      {/* 월 헤더 */}
      <View className="flex-row items-center mb-[14px]">
        <TouchableOpacity onPress={goToPrevMonth} className="pr-[10px]">
          <Text className="text-[22px] font-medium text-teal-accent">{'<'}</Text>
        </TouchableOpacity>
        <Text className="text-[28px] font-extrabold text-primary" style={{letterSpacing: -0.5}}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} className="pl-[10px]">
          <Text className="text-[22px] font-medium text-teal-accent">{'>'}</Text>
        </TouchableOpacity>
      </View>

      {/* 요일 레이블 */}
      <View className="flex-row mb-1">
        {DAY_LABELS.map(label => (
          <View key={label} className="flex-1 items-center pb-[6px]">
            <Text className="text-[11px] font-medium text-tertiary" style={{letterSpacing: 0.4}}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* 날짜 그리드 */}
      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row border-t-[0.5px] border-line">
          {week.map((day, di) => {
            const eventDay = day ? getEventDay(day) : undefined;
            const highlighted = !!day && isSelected(day);

            return (
              <TouchableOpacity
                key={di}
                disabled={!day}
                onPress={() => day && onDateSelect?.(new Date(year, month, day))}
                className="flex-1 items-center py-[10px]"
              >
                {day !== null && (
                  <>
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{backgroundColor: highlighted ? Colors.tealAccent : 'transparent'}}
                    >
                      <Text
                        className={`text-[15px] ${highlighted ? 'font-bold text-white' : 'font-normal text-primary'}`}
                      >
                        {day}
                      </Text>
                    </View>

                    {eventDay?.has_timeline && (
                      <View className="flex-row gap-x-[3px] mt-[3px]">
                        <View className="w-1 h-1 rounded-full bg-teal-accent" />
                        {eventDay.has_journal && (
                          <View className="w-1 h-1 rounded-full bg-teal-dark" />
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
