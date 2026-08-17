import {memo, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

import {type CalendarDay} from '@/services/calendarApi';
import {useThemeColors} from '@/hooks/useThemeColors';

const SCREEN_WIDTH = Dimensions.get('window').width;

/** 이만큼 끌면 달이 넘어간다 */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.22;

/** 짧게 튕겨도 넘어가게 하는 속도 임계값 */
const SWIPE_VELOCITY = 0.35;

/** 손가락을 따라가는 정도. 1이면 그대로 따라와 너무 헐렁하다 */
const DRAG_RESISTANCE = 0.35;

/** 달이 갈릴 때 밀려나는 거리 */
const SLIDE_DISTANCE = SCREEN_WIDTH * 0.25;

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

function Calendar({
  selectedDate,
  onDateSelect,
  viewDate,
  onViewDateChange,
  eventDays = [],
}: Props) {
  const tc = useThemeColors();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  /** 달 전환 애니메이션. `delta` +1이면 다음 달, -1이면 이전 달 */
  const changeMonth = useCallback(
    (delta: number) => {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -delta * SLIDE_DISTANCE,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onViewDateChange(new Date(year, month + delta, 1));

        // 새 달을 반대편에 세워두고 제자리로 당긴다
        translateX.setValue(delta * SLIDE_DISTANCE);
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 70,
            friction: 11,
            overshootClamping: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [onViewDateChange, year, month, translateX, opacity],
  );

  const goToPrevMonth = useCallback(() => changeMonth(-1), [changeMonth]);
  const goToNextMonth = useCallback(() => changeMonth(1), [changeMonth]);

  /**
   * 가로 스와이프로 달 이동. 세로가 더 크면 잡지 않는다 —
   * 바텀시트의 세로 드래그와 서로 뺏지 않기 위해서다.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, {dx, dy}) =>
          Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5,
        onPanResponderMove: (_, {dx}) => {
          translateX.setValue(dx * DRAG_RESISTANCE);
        },
        onPanResponderRelease: (_, {dx, vx}) => {
          const goPrev = dx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY;
          const goNext = dx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY;

          if (goPrev) changeMonth(-1);
          else if (goNext) changeMonth(1);
          else {
            // 임계값에 못 미치면 제자리로
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 70,
              friction: 11,
            }).start();
          }
        },
      }),
    [changeMonth, translateX],
  );

  // 달이 바뀔 때만 다시 만든다 — 시트 드래그마다 42칸을 새로 짜지 않도록
  const weeks = useMemo<(number | null)[][]>(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [
      ...Array(firstDayOfWeek).fill(null),
      ...Array.from({length: daysInMonth}, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return Array.from({length: cells.length / 7}, (_, i) =>
      cells.slice(i * 7, i * 7 + 7),
    );
  }, [year, month]);

  /** 날짜 → 기록 여부. 칸마다 훑지 않도록 Map으로 한 번만 만든다 */
  const eventByDay = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const d of eventDays) map.set(d.date, d);
    return map;
  }, [eventDays]);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // 칸마다 Date를 만들지 않고 일(day) 숫자만 비교한다
  const selectedDay =
    selectedDate &&
    selectedDate.getFullYear() === year &&
    selectedDate.getMonth() === month
      ? selectedDate.getDate()
      : null;

  return (
    <Animated.View
      className="bg-card px-4 pt-5"
      style={{transform: [{translateX}], opacity}}
      {...panResponder.panHandlers}
    >

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

      <View className="flex-row mb-1">
        {DAY_LABELS.map(label => (
          <View key={label} className="flex-1 items-center pb-[6px]">
            <Text className="text-[11px] font-medium text-dow" style={{letterSpacing: 0.4}}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row border-t-[0.5px] border-line">
          {week.map((day, di) => {
            const eventDay = day
              ? eventByDay.get(`${monthPrefix}-${String(day).padStart(2, '0')}`)
              : undefined;
            const highlighted = day !== null && day === selectedDay;

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
                      style={{backgroundColor: highlighted ? tc.tealAccent : 'transparent'}}
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

    </Animated.View>
  );
}

/** 시트를 드래그할 때마다 달력 42칸을 다시 그릴 이유가 없다 */
export default memo(Calendar);
