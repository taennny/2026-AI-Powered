/**
 * @file components/bottomsheet/BottomSheet.tsx
 * @description 홈 화면 바텀시트 컴포넌트
 * - PanResponder 기반 드래그 제스처로 위/아래 이동
 * - 3단계 스냅: expanded(0) ↔ peek ↔ handleOnly
 * - 날짜 헤더 + 시간대별 타임라인 레이아웃
 *
 * ## 다음 연결 작업
 * - [ ] ScrollView 스크롤 ↔ 바텀시트 드래그 제스처 충돌 처리 검토
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
  /** 캘린더에서 선택된 날짜 — 헤더 표시에 사용 */
  selectedDate?: Date;
  /** peek 상태에서 화면에 노출될 시트 높이 (px) */
  peekHeight?: number;
  /** 선택된 날짜의 타임라인 장소 목록 — 부모에서 전달 */
  places: TimelinePlace[];
};

/** 장소 배열을 arrived_at 기준 hour로 그룹핑 */
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

      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },

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
        Animated.spring(translateY, {
          toValue: snapTo,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      },
    }),
  ).current;

  const hourGroups = groupByHour(places);
  const hasPlaces = hourGroups.length > 0;
  hasPlacesRef.current = hasPlaces; // 리스너 클로저에서 최신값 참조용

  return (
    <Animated.View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: Colors.tealBg,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        transform: [{translateY}],
      }}
      {...panResponder.panHandlers}
    >
      <View style={{alignItems: 'center', paddingTop: 10, paddingBottom: 6}}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: Colors.tealDark,
          }}
        />
      </View>

      <Text
        style={{
          textAlign: 'center',
          fontSize: 15,
          fontWeight: '700',
          color: Colors.textPrimary,
          marginBottom: 16,
        }}
      >
        {formatDate(selectedDate)}
      </Text>

      {isMapMounted && hasPlaces && (
        <Animated.View style={{opacity: mapOpacity}}>
          <MapPreview places={places} />
        </Animated.View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 32}}
      >
        {!hasPlaces ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              paddingVertical: 18,
              paddingHorizontal: 16,
              borderLeftWidth: 8,
              borderLeftColor: Colors.teal,
              borderRadius: 4,
            }}
          >
            <Text style={{fontSize: 14, color: Colors.textSecondary, lineHeight: 22}}>
              아직 기록된 일기가 없어요.{'\n'}글을 쓰러 가볼까요?
            </Text>
          </View>
        ) : (
          <View style={{position: 'relative', paddingHorizontal: 16}}>
            <View
              style={{
                position: 'absolute',
                left: 16 + BAR_LEFT,
                top: 0,
                bottom: 0,
                width: 8,
                backgroundColor: Colors.teal,
              }}
            />

            {hourGroups.map(({hour, places: hourPlaces}) => (
              <View key={hour} style={{flexDirection: 'row', marginBottom: 8}}>
                <View
                  style={{
                    width: 32,
                    paddingTop: 14,
                    alignItems: 'flex-end',
                    paddingRight: 8,
                  }}
                >
                  <Text
                    style={{fontSize: 12, fontWeight: '500', color: Colors.textTertiary}}
                  >
                    {hour}
                  </Text>
                </View>

                <View style={{width: 24}} />

                <View style={{flex: 1}}>
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
