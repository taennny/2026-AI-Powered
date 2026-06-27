/**
 * @file components/bottomsheet/BottomSheet.tsx — 홈 바텀시트
 * - PanResponder 3단계 스냅: expanded ↔ peek ↔ handleOnly
 * - expanded 시 MapPreview 페이드인
 *
 * ## 다음 연결 작업
 * - [ ] ScrollView 스크롤 ↔ 드래그 제스처 충돌 처리 검토
 */

import {useRef, useCallback, useState, useEffect} from 'react';
import {
  Animated,
  PanResponder,
  ScrollView,
  Text,
  View,
  LayoutChangeEvent,
} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatDate} from '@/utils/formatDate';
import PostCard from '@/components/bottomsheet/PostCard';
import MapPreview from '@/components/bottomsheet/MapPreview';

type Props = {
  selectedDate?: Date;
  peekHeight?: number;
  places: TimelinePlace[];
};

function groupByHour(
  places: TimelinePlace[],
): {hour: number; places: TimelinePlace[]}[] {
  const map = new Map<number, TimelinePlace[]>();
  places.forEach(place => {
    const hour = new Date(place.arrived_at).getHours();
    if (!map.has(hour)) map.set(hour, []);
    map.get(hour)!.push(place);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, ps]) => ({hour, places: ps}));
}

const BAR_LEFT = 40;

export default function BottomSheet({
  selectedDate = new Date(),
  peekHeight = 320,
  places,
}: Props) {
  const sheetHeight = useRef(0);
  const translateY = useRef(new Animated.Value(9999)).current;
  // collapse(가장 아래) 시 남겨둘 노출 높이 = 핸들 + 날짜 헤더 실측값(폰트 확대 등 대응). 측정 전 폴백 64
  const collapsedPeekRef = useRef(64);
  const lastY = useRef(0);
  const peekHeightRef = useRef(peekHeight);
  const currentSnap = useRef<'expanded' | 'peek' | 'collapsed'>('peek');

  // 현재 snap에서 "화면에 보이는 시트 높이". 이 높이로 콘텐츠 영역을 한정해야
  // 내부 ScrollView(flex:1)가 보이는 영역 기준으로 스크롤됨(peek에서도 카드 스크롤 가능).
  const [visibleH, setVisibleH] = useState<number | null>(null);

  const [showMap, setShowMap] = useState(false);
  const [isMapMounted, setIsMapMounted] = useState(false);
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const hasPlacesRef = useRef(false);

  useEffect(() => {
    const listenerId = translateY.addListener(({value}) => {
      const threshold = sheetHeight.current * 0.45;
      setShowMap(value < threshold && hasPlacesRef.current);
    });
    return () => translateY.removeListener(listenerId);
  }, [translateY]);

  useEffect(() => {
    if (showMap) {
      setIsMapMounted(true);
      Animated.timing(mapOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(mapOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setIsMapMounted(false));
    }
  }, [showMap, mapOpacity]);

  // 현재 snap 상태에 해당하는 translateY 위치 계산
  const snapPositionFor = useCallback(
    (state: 'expanded' | 'peek' | 'collapsed', h: number) => {
      if (state === 'expanded') return 0;
      if (state === 'collapsed') return h - collapsedPeekRef.current;
      return h - peekHeightRef.current;
    },
    [],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      sheetHeight.current = h;
      // 재레이아웃(월 이동 등) 시에도 현재 snap 상태를 유지 — 항상 peek로 올라오지 않도록
      const target = snapPositionFor(currentSnap.current, h);
      translateY.setValue(target);
      lastY.current = target;
      setVisibleH(h - target);
    },
    [translateY, snapPositionFor],
  );

  // 월 이동 등으로 달력 높이(peekHeight)가 바뀌면 ref 갱신 + peek에 머물러 있을 땐 새 위치로 재정렬
  useEffect(() => {
    peekHeightRef.current = peekHeight;
    if (sheetHeight.current > 0 && currentSnap.current === 'peek') {
      const peek = sheetHeight.current - peekHeight;
      lastY.current = peek;
      setVisibleH(peekHeight);
      Animated.spring(translateY, {
        toValue: peek,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
        overshootClamping: true,
      }).start();
    }
  }, [peekHeight, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, {dy}) => Math.abs(dy) > 5,
      onPanResponderGrant: () => {
        translateY.stopAnimation();
        // 드래그 중에는 콘텐츠 영역을 전체 높이로 펼쳐 둠 → 시트 아래 빈 공간 안 생기게
        setVisibleH(sheetHeight.current);
      },
      onPanResponderMove: (_, {dy}) => {
        const handleOnly = sheetHeight.current - collapsedPeekRef.current;
        const next = Math.max(0, Math.min(handleOnly, lastY.current + dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, {dy, vy}) => {
        const peek = sheetHeight.current - peekHeightRef.current;
        const handleOnly = sheetHeight.current - collapsedPeekRef.current;
        const next = Math.max(0, Math.min(handleOnly, lastY.current + dy));

        let snapTo: number;
        if (vy < -0.5 || next < peek / 2) {
          snapTo = 0;
          currentSnap.current = 'expanded';
        } else if (vy > 0.5 || next > (peek + handleOnly) / 2) {
          snapTo = handleOnly;
          currentSnap.current = 'collapsed';
        } else {
          snapTo = peek;
          currentSnap.current = 'peek';
        }

        lastY.current = snapTo;
        // snap 확정 → 보이는 높이로 콘텐츠 영역 한정 (peek에서도 ScrollView가 스크롤됨)
        setVisibleH(sheetHeight.current - snapTo);
        Animated.spring(translateY, {
          toValue: snapTo,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
          // 경계(handleOnly/expanded)를 지나쳤다 되돌아오는 과한 바운스 방지
          overshootClamping: true,
        }).start();
      },
    }),
  ).current;

  const tc = useThemeColors();
  const hourGroups = groupByHour(places);
  const hasPlaces = hourGroups.length > 0;
  hasPlacesRef.current = hasPlaces;

  return (
    <Animated.View
      onLayout={onLayout}
      className="absolute left-0 right-0 top-0 bottom-0 bg-teal-bg rounded-tl-[20px] rounded-tr-[20px]"
      style={{transform: [{translateY}]}}
    >
      {/* 보이는 영역 한정 래퍼 — 이 높이 안에서 ScrollView(flex:1)가 스크롤됨 */}
      <View style={visibleH != null ? {height: visibleH} : {flex: 1}}>
        {/* 핸들 + 날짜 헤더 — 이 영역 드래그 시에만 시트 전체 이동 */}
        <View
          {...panResponder.panHandlers}
          onLayout={e => {
            collapsedPeekRef.current = e.nativeEvent.layout.height;
          }}
        >
          {/* 핸들 */}
          <View className="items-center pt-[10px] pb-[6px]">
            <View className="w-9 h-1 rounded-full bg-teal-dark" />
          </View>

          {/* 날짜 헤더 */}
          <Text className="text-center text-[15px] font-bold text-primary mb-4">
            {formatDate(selectedDate)}
          </Text>
        </View>

        {/* 지도 미리보기 — 지도 위 드래그도 시트 전체 이동(목록 스크롤 아님) */}
        {isMapMounted && hasPlaces && (
          <Animated.View
            style={{opacity: mapOpacity}}
            {...panResponder.panHandlers}
          >
            <MapPreview places={places} />
          </Animated.View>
        )}

        <ScrollView
          style={{flex: 1}}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 32}}
        >
          {!hasPlaces ? (
            <View
              className="mx-4 mt-2 py-[18px] px-4 rounded-sm"
              style={{borderLeftWidth: 8, borderLeftColor: tc.teal}}
            >
              <Text className="text-sm text-secondary leading-[22px]">
                기록된 동선이 없습니다.{'\n'}원활한 기록을 위해 위치 권한을
                허용해주세요.
              </Text>
            </View>
          ) : (
            <View className="relative px-4">
              {/* 세로 타임라인 바 */}
              <View
                className="absolute top-0 bottom-0 w-2 bg-teal"
                style={{left: 6 + BAR_LEFT}}
              />
              {hourGroups.map(({hour, places: hourPlaces}) => (
                <View key={hour} className="flex-row mb-2">
                  <View className="w-8 pt-[14px] items-end pr-2">
                    <Text className="text-xs font-medium text-tertiary">
                      {hour}
                    </Text>
                  </View>
                  <View className="w-6" />
                  <View className="flex-1">
                    {hourPlaces.map(place => (
                      <PostCard key={place.place_id} data={place} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
}
