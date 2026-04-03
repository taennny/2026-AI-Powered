/**
 * @file components/bottomsheet/BottomSheet.tsx
 * @description 홈 화면 바텀시트 배경 컴포넌트
 * - PanResponder 기반 드래그 제스처로 위/아래 이동
 * - peek(일부 노출) ↔ expanded(전체 노출) 두 스냅 포인트
 * - peekHeight prop으로 peek 상태의 노출 높이 조절 가능 (기본값 320px)
 *
 * ## 다음 연결 작업
 * - [ ] children으로 날짜 헤더(PostDateHeader) 연결
 * - [ ] children으로 PostCard 리스트 연결
 * - [ ] 스냅 포인트 3단계로 확장 필요 시 snapPoints prop 추가 검토
 */

import {useRef, ReactNode, useCallback} from 'react';
import {Animated, PanResponder, View, LayoutChangeEvent} from 'react-native';

type Props = {
  children?: ReactNode;
  /** peek 상태에서 화면에 노출될 시트 높이 (px) */
  peekHeight?: number;
};

export default function BottomSheet({children, peekHeight = 320}: Props) {
  // 시트 전체 높이 — onLayout에서 측정 후 저장
  const sheetHeight = useRef(0);

  // translateY = 0이면 완전히 펼쳐진 상태, sheetHeight - peekHeight이면 peek 상태
  // 초기값 9999: 레이아웃 측정 전 시트가 화면에 보이지 않도록 숨겨둠
  const translateY = useRef(new Animated.Value(9999)).current;

  // 드래그 종료 시점의 translateY를 기억해 다음 제스처의 기준점으로 사용
  const lastY = useRef(0);

  // peekHeight를 PanResponder 클로저 내에서 안정적으로 참조하기 위해 ref로 보관
  const peekHeightRef = useRef(peekHeight);

  // 컨테이너 높이가 확정된 후 peek 위치로 초기 배치
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      sheetHeight.current = h;
      const peekOffset = h - peekHeightRef.current; // peek 상태의 translateY 값
      translateY.setValue(peekOffset);
      lastY.current = peekOffset;
    },
    [translateY],
  );

  const panResponder = useRef(
    PanResponder.create({
      // 5px 이상 수직 이동 시에만 제스처 인식 (스크롤과 충돌 방지)
      onMoveShouldSetPanResponder: (_, {dy}) => Math.abs(dy) > 5,

      // 드래그 시작: 진행 중인 spring 애니메이션 즉시 중단
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },

      // 드래그 중: lastY 기준으로 dy만큼 이동, 상단 경계(0) 이상으로 올라가지 않도록 제한
      onPanResponderMove: (_, {dy}) => {
        const next = Math.max(0, lastY.current + dy);
        translateY.setValue(next);
      },

      // 드래그 종료: 속도(vy) 또는 위치 기준으로 스냅 포인트 결정 후 spring 애니메이션
      onPanResponderRelease: (_, {dy, vy}) => {
        const peek = sheetHeight.current - peekHeightRef.current;
        const next = Math.max(0, lastY.current + dy);

        // 위로 빠르게 스와이프(vy < -0.5)하거나 중간 이상 끌어올리면 expanded로 스냅
        const snapTo = vy < -0.5 || next < peek / 2 ? 0 : peek;

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

  return (
    // 부모 컨테이너(home/index.tsx의 flex:1 View)를 꽉 채우도록 absolute 배치
    // translateY로 위치를 조절해 peek/expanded 전환
    <Animated.View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#D8E6E8',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        transform: [{translateY}],
      }}
      {...panResponder.panHandlers}
    >
      {/* 드래그 가능 영역임을 시각적으로 표시하는 핸들 바 */}
      <View style={{alignItems: 'center', paddingTop: 10, paddingBottom: 6}}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#A0B4B8',
          }}
        />
      </View>

      {/* TODO: PostDateHeader, PostCard 리스트 등 콘텐츠 삽입 */}
      {children}
    </Animated.View>
  );
}
