/**
 * 왼쪽으로 밀면 오른쪽에서 동작 버튼이 드러나는 행.
 *
 * 세로 스크롤을 뺏지 않는 게 핵심이다 — 시트 안 ScrollView에 들어가므로
 * 가로 이동이 세로보다 분명할 때만 제스처를 가져온다.
 */

import {useCallback, useEffect, useRef} from 'react';
import {Animated, PanResponder, View} from 'react-native';

/** 제스처를 가져오는 최소 가로 이동량. 탭이 스와이프로 오인되지 않을 정도 */
const CLAIM_THRESHOLD = 8;

/** 이만큼 밀었거나 이 속도를 넘으면 연다 */
const OPEN_RATIO = 0.4;
const FLING_VELOCITY = 0.3;

export function shouldOpen(dx: number, vx: number, width: number): boolean {
  if (vx < -FLING_VELOCITY) return true;
  if (vx > FLING_VELOCITY) return false;
  return -dx > width * OPEN_RATIO;
}

/**
 * 열린 행은 항상 하나다 — 여러 개가 열려 있으면 어느 걸 지우는지 헷갈린다.
 * 새로 열릴 때 이전 것을 닫는다.
 */
let closeOpenRow: (() => void) | null = null;

type Props = {
  /** 드러날 버튼들. 오른쪽에 이 너비만큼 자리를 잡는다 */
  actions: React.ReactNode;
  actionsWidth: number;
  children: React.ReactNode;
};

export default function SwipeableRow({actions, actionsWidth, children}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const animateTo = useCallback(
    (to: number) => {
      offset.current = to;
      Animated.spring(translateX, {
        toValue: to,
        useNativeDriver: true,
        tension: 70,
        friction: 11,
      }).start();
    },
    [translateX],
  );

  const close = useCallback(() => {
    if (closeOpenRow === close) closeOpenRow = null;
    animateTo(0);
  }, [animateTo]);

  const open = useCallback(() => {
    if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
    closeOpenRow = close;
    animateTo(-actionsWidth);
  }, [actionsWidth, animateTo, close]);

  // 언마운트된 행이 등록된 채로 남으면 다음 행이 열릴 때 없는 걸 닫는다
  useEffect(() => {
    return () => {
      if (closeOpenRow === close) closeOpenRow = null;
    };
  }, [close]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, {dx, dy}) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > CLAIM_THRESHOLD,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, {dx}) => {
        // 왼쪽으로만 열린다. 오른쪽으로 당기면 조금만 따라오게 해 벽을 느끼게 한다
        const next = offset.current + dx;
        translateX.setValue(
          next > 0 ? next * 0.2 : Math.max(next, -actionsWidth * 1.2),
        );
      },
      onPanResponderRelease: (_, {dx, vx}) => {
        if (offset.current === 0) {
          shouldOpen(dx, vx, actionsWidth) ? open() : close();
          return;
        }
        // 이미 열려 있으면 반대 판정 — 오른쪽으로 밀거나 느리게 놓으면 닫힌다
        shouldOpen(-dx, -vx, actionsWidth) ? close() : open();
      },
      onPanResponderTerminate: () => close(),
    }),
  ).current;

  const actionsOpacity = translateX.interpolate({
    inputRange: [-actionsWidth, -actionsWidth / 2, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 10,
          width: actionsWidth,
          flexDirection: 'row',
          opacity: actionsOpacity,
        }}
      >
        {actions}
      </Animated.View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{transform: [{translateX}]}}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/** 시트가 닫히거나 화면을 떠날 때 — 열린 채로 남지 않게 */
export function closeAnyOpenRow(): void {
  closeOpenRow?.();
}
