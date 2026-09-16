import {useRef, useState} from 'react';
import {View, Image, PanResponder, Pressable, Dimensions} from 'react-native';
import {router} from 'expo-router';

import {markOnboardingDone} from '@/utils/onboardingStorage';

const {width, height} = Dimensions.get('window');

/** 왼쪽 이 비율만큼이 '이전', 나머지가 '다음' */
const BACK_ZONE = 0.2;

/** 이 거리를 넘겨야 제스처를 가져온다 — 탭이 스와이프로 오인되지 않게 */
const CLAIM_THRESHOLD = 10;

/** 놓았을 때 넘길지 판단하는 기준 (거리 또는 속도) */
const SWIPE_DISTANCE = 50;
const SWIPE_VELOCITY = 0.3;

const IMAGES = [
  require('../assets/onboarding/onboarding1.jpeg'),
  require('../assets/onboarding/onboarding2.jpeg'),
  require('../assets/onboarding/onboarding3.jpeg'),
  require('../assets/onboarding/onboarding4.jpeg'),
  require('../assets/onboarding/onboarding5.jpeg'),
  require('../assets/onboarding/onboarding6.jpeg'),
  require('../assets/onboarding/onboarding7.jpeg'),
  require('../assets/onboarding/onboarding8.jpeg'),
  require('../assets/onboarding/onboarding9.jpeg'),
  require('../assets/onboarding/onboarding10.jpeg'),
  require('../assets/onboarding/onboarding11.jpeg'),
  require('../assets/onboarding/onboarding12.jpeg'),
  require('../assets/onboarding/onboarding13.jpeg'),
  require('../assets/onboarding/onboarding14.jpeg'),
  require('../assets/onboarding/onboarding15.jpeg'),
  require('../assets/onboarding/onboarding16.jpeg'),
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // PanResponder는 한 번만 만들어져 첫 렌더의 state를 붙잡는다 — ref로 지금 값을 읽는다
  const indexRef = useRef(0);
  indexRef.current = currentIndex;

  const isLeavingRef = useRef(false);

  const goNext = async () => {
    if (indexRef.current < IMAGES.length - 1) {
      setCurrentIndex(indexRef.current + 1);
      return;
    }
    // 마지막 장에서 탭·스와이프가 겹치면 router.replace가 두 번 불린다
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    await markOnboardingDone();
    router.replace('/(main)/(tabs)/home');
  };

  // 첫 장에서는 돌아갈 곳이 없다 — 아무 일도 하지 않는다
  const goBack = () => {
    if (indexRef.current > 0) setCurrentIndex(indexRef.current - 1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, {dx, dy}) =>
        Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > CLAIM_THRESHOLD,
      onPanResponderRelease: (_, {dx, vx}) => {
        // 짧게 튕기는 동작이 흔해서 거리만 보면 안 잡힌다.
        // 속도는 방향이 같을 때만 본다 — 끌다가 반대로 튕기면 의도와 거꾸로 간다
        const far = Math.abs(dx) > SWIPE_DISTANCE;
        const flicked =
          Math.abs(vx) > SWIPE_VELOCITY && Math.sign(vx) === Math.sign(dx);
        if (!far && !flicked) return;

        if (dx < 0) void goNext();
        else goBack();
      },
    }),
  ).current;

  return (
    <View
      style={{flex: 1, backgroundColor: '#000'}}
      {...panResponder.panHandlers}
    >
      <Image
        source={IMAGES[currentIndex]}
        style={{width, height, resizeMode: 'cover'}}
        fadeDuration={0}
      />

      <Pressable
        onPress={goBack}
        accessibilityLabel="이전"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: width * BACK_ZONE,
        }}
      />

      <Pressable
        onPress={() => void goNext()}
        accessibilityLabel="다음"
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: width * (1 - BACK_ZONE),
        }}
      />
    </View>
  );
}
