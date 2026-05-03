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
import {Colors} from '@/constants/Colors';
import {formatDate} from '@/utils/formatDate';
import PostCard from '@/components/bottomsheet/PostCard';
import MapPreview from '@/components/bottomsheet/MapPreview';

type Props = {
  selectedDate?: Date;
  peekHeight?: number;
  places: TimelinePlace[];
};

function groupByHour(places: TimelinePlace[]): {hour: number; places: TimelinePlace[]}[] {
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

export default function BottomSheet({selectedDate = new Date(), peekHeight = 320, places}: Props) {
  const sheetHeight = useRef(0);
  const translateY = useRef(new Animated.Value(9999)).current;
  const HANDLE_HEIGHT = 30;
  const lastY = useRef(0);
  const peekHeightRef = useRef(peekHeight);

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
      Animated.timing(mapOpacity, {toValue: 1, duration: 200, useNativeDriver: true}).start();
    } else {
      Animated.timing(mapOpacity, {toValue: 0, duration: 200, useNativeDriver: true})
        .start(() => setIsMapMounted(false));
    }
  }, [showMap, mapOpacity]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      sheetHeight.current = h;
      const peekOffset = h - peekHeightRef.current;
      translateY.setValue(peekOffset);
      lastY.current = peekOffset;
    },
    [translateY],
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, {dy}) => Math.abs(dy) > 5,
      onPanResponderGrant: () => { translateY.stopAnimation(); },
      onPanResponderMove: (_, {dy}) => {
        const handleOnly = sheetHeight.current - HANDLE_HEIGHT;
        const next = Math.max(0, Math.min(handleOnly, lastY.current + dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, {dy, vy}) => {
        const peek = sheetHeight.current - peekHeightRef.current;
        const handleOnly = sheetHeight.current - HANDLE_HEIGHT;
        const next = Math.max(0, Math.min(handleOnly, lastY.current + dy));

        let snapTo: number;
        if (vy < -0.5 || next < peek / 2) {
          snapTo = 0;
        } else if (vy > 0.5 || next > (peek + handleOnly) / 2) {
          snapTo = handleOnly;
        } else {
          snapTo = peek;
        }

        lastY.current = snapTo;
        Animated.spring(translateY, {toValue: snapTo, useNativeDriver: true, tension: 65, friction: 11}).start();
      },
    }),
  ).current;

  const hourGroups = groupByHour(places);
  const hasPlaces = hourGroups.length > 0;
  hasPlacesRef.current = hasPlaces;

  return (
    <Animated.View
      onLayout={onLayout}
      className="absolute left-0 right-0 top-0 bottom-0 bg-teal-bg rounded-tl-[20px] rounded-tr-[20px]"
      style={{transform: [{translateY}]}}
      {...panResponder.panHandlers}
    >
      {/* 핸들 */}
      <View className="items-center pt-[10px] pb-[6px]">
        <View className="w-9 h-1 rounded-full bg-teal-dark" />
      </View>

      {/* 날짜 헤더 */}
      <Text className="text-center text-[15px] font-bold text-primary mb-4">
        {formatDate(selectedDate)}
      </Text>

      {/* 지도 미리보기 */}
      {isMapMounted && hasPlaces && (
        <Animated.View style={{opacity: mapOpacity}}>
          <MapPreview places={places} />
        </Animated.View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 32}}>
        {!hasPlaces ? (
          <View
            className="mx-4 mt-2 py-[18px] px-4 rounded-sm"
            style={{borderLeftWidth: 8, borderLeftColor: Colors.teal}}
          >
            <Text className="text-sm text-secondary leading-[22px]">
              아직 기록된 일기가 없어요.{'\n'}글을 쓰러 가볼까요?
            </Text>
          </View>
        ) : (
          <View className="relative px-4">
            {/* 세로 타임라인 바 */}
            <View
              className="absolute top-0 bottom-0 w-2 bg-teal"
              style={{left: 16 + BAR_LEFT}}
            />
            {hourGroups.map(({hour, places: hourPlaces}) => (
              <View key={hour} className="flex-row mb-2">
                <View className="w-8 pt-[14px] items-end pr-2">
                  <Text className="text-xs font-medium text-tertiary">{hour}</Text>
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
    </Animated.View>
  );
}
