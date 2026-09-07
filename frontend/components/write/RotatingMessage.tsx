/**
 * 문구 끝의 말줄임표를 한 점씩 채우고(`.` → `..` → `...`),
 * 정해진 횟수만큼 채우고 나면 페이드로 다음 문구로 넘어간다.
 * **마지막 문구에서는 넘어가지 않는다** — 점만 계속 움직여 살아 있음을 알린다.
 *
 * 문구 목록은 `constants/loadingMessages.ts`에 있다 — 여기는 보여주는 방법만 안다.
 */

import {useEffect, useRef, useState} from 'react';
import {Animated, View} from 'react-native';

import {
  DOT_CYCLES_PER_MESSAGE,
  DOT_STEP_MS,
  MESSAGE_FADE_MS,
} from '@/constants/loadingMessages';
import {withDots} from '@/utils/loadingSequence';

/** 말줄임표는 점 세 개까지 */
const MAX_DOTS = 3;

type Props = {
  messages: readonly string[];
  dotStepMs?: number;
  cyclesPerMessage?: number;
  fadeMs?: number;
};

export default function RotatingMessage({
  messages,
  dotStepMs = DOT_STEP_MS,
  cyclesPerMessage = DOT_CYCLES_PER_MESSAGE,
  fadeMs = MESSAGE_FADE_MS,
}: Props) {
  const [index, setIndex] = useState(0);
  /** 점이 한 번 늘어날 때마다 1씩. 문구가 바뀌어도 이어서 센다 */
  const [tick, setTick] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stepsPerMessage = MAX_DOTS * cyclesPerMessage;
  const isLastMessage = index >= messages.length - 1;

  useEffect(() => {
    const timer = setTimeout(() => {
      // 점이 마지막으로 세 개가 된 다음 칸에서 넘어간다
      const shouldAdvance =
        (tick + 1) % stepsPerMessage === 0 && !isLastMessage;

      if (!shouldAdvance) {
        setTick(current => current + 1);
        return;
      }

      Animated.timing(opacity, {
        toValue: 0,
        duration: fadeMs,
        useNativeDriver: true,
      }).start(() => {
        if (!isMountedRef.current) return;

        setIndex(current => current + 1);
        // stepsPerMessage가 MAX_DOTS의 배수라 새 문구는 점 하나에서 시작한다
        setTick(current => current + 1);

        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeMs,
          useNativeDriver: true,
        }).start();
      });
    }, dotStepMs);

    return () => clearTimeout(timer);
  }, [tick, isLastMessage, stepsPerMessage, dotStepMs, fadeMs, opacity]);

  const dotCount = (tick % MAX_DOTS) + 1;

  return (
    // 높이를 고정한다 — 문구마다 줄 수가 달라 컨테이너가 들썩이면
    // 위아래 요소(스피너)가 같이 밀린다
    <View className="h-[44px] px-10 justify-center">
      <Animated.Text
        className="text-sm text-tertiary text-center leading-[20px]"
        style={{opacity}}
      >
        {withDots(messages[index] ?? '', dotCount)}
      </Animated.Text>
    </View>
  );
}
