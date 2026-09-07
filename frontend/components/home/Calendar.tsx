import {memo, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import {type CalendarDay} from '@/services/calendarApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {type ThemeColors} from '@/constants/themes';
import {
  isSelecting as hasSelection,
  useDateSelectionStore,
} from '@/store/dateSelectionStore';

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
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 선택 오버레이가 켜지고 꺼지는 시간 */
const PICK_FADE_MS = 180;

type DayCellProps = {
  day: number | null;
  eventDay?: CalendarDay;
  isPicked: boolean;
  highlighted: boolean;
  onPress: () => void;
  onLongPress: () => void;
  tc: ThemeColors;
};

/**
 * 날짜 한 칸. 셀마다 애니메이션 값이 필요해 컴포넌트로 뺐다 —
 * `map` 안에서는 훅을 못 쓴다.
 */
function DayCell({
  day,
  eventDay,
  isPicked,
  highlighted,
  onPress,
  onLongPress,
  tc,
}: DayCellProps) {
  const pickOpacity = useRef(new Animated.Value(isPicked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pickOpacity, {
      toValue: isPicked ? 1 : 0,
      duration: PICK_FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [isPicked, pickOpacity]);

  return (
    <TouchableOpacity
      disabled={!day}
      onPress={onPress}
      onLongPress={onLongPress}
      // 누르는 동안 흐려지면 롱프레스로 칠해진 회색이 안 보인다 —
      // 손을 떼야 선택된 것처럼 느껴진다
      activeOpacity={1}
      className="flex-1 items-center py-[10px]"
    >
      {/* 칸 전체를 덮는 오버레이 (아이폰 캘린더와 같은 방식).
          숫자 뒤 도형으로 표시하면 단일 선택 동그라미와 모양이 경쟁한다 */}
      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: `${tc.tealDark}33`,
          opacity: pickOpacity,
        }}
      />

      {day !== null && (
        <>
          <View
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{
              backgroundColor: highlighted ? tc.tealAccent : 'transparent',
            }}
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
}

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

  const selected = useDateSelectionStore(s => s.selected);
  const toggleSelected = useDateSelectionStore(s => s.toggle);
  const selecting = hasSelection(selected);
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
          <Text className="text-[22px] font-medium text-teal-accent">
            {'<'}
          </Text>
        </TouchableOpacity>
        <Text
          className="text-[28px] font-extrabold text-primary"
          style={{letterSpacing: -0.5}}
        >
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} className="pl-[10px]">
          <Text className="text-[22px] font-medium text-teal-accent">
            {'>'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-1">
        {DAY_LABELS.map(label => (
          <View key={label} className="flex-1 items-center pb-[6px]">
            <Text
              className="text-[11px] font-medium text-dow"
              style={{letterSpacing: 0.4}}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row border-t-[0.5px] border-line">
          {week.map((day, di) => {
            const dateKey = day
              ? `${monthPrefix}-${String(day).padStart(2, '0')}`
              : null;
            const eventDay = dateKey ? eventByDay.get(dateKey) : undefined;
            const isPicked = dateKey !== null && dateKey in selected;
            // 선택 모드에서도 그대로 둔다 — 시트에는 이 날짜의 타임라인이
            // 계속 떠 있어서, 지우면 어느 날 기록인지 알 수 없어진다
            const highlighted = day !== null && day === selectedDay;

            return (
              <DayCell
                key={di}
                day={day}
                eventDay={eventDay}
                isPicked={isPicked}
                highlighted={highlighted}
                tc={tc}
                onPress={() => {
                  if (!day || !dateKey) return;
                  if (selecting) {
                    void Haptics.selectionAsync();
                    toggleSelected(dateKey, !!eventDay?.has_timeline);
                  } else {
                    onDateSelect?.(new Date(year, month, day));
                  }
                }}
                onLongPress={() => {
                  if (!dateKey) return;
                  // 선택 모드 진입은 탭보다 무겁게 — 상태가 바뀌는 동작이다
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  toggleSelected(dateKey, !!eventDay?.has_timeline);
                }}
              />
            );
          })}
        </View>
      ))}
    </Animated.View>
  );
}

/** 시트를 드래그할 때마다 달력 42칸을 다시 그릴 이유가 없다 */
export default memo(Calendar);
