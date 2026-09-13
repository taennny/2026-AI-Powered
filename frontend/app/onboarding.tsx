import {useState, useRef} from 'react';
import {View, Image, Pressable, FlatList, Dimensions} from 'react-native';
import {router} from 'expo-router';

import {markOnboardingDone} from '@/utils/onboardingStorage';

const {width, height} = Dimensions.get('window');

/** 왼쪽 이 비율만큼이 '이전', 나머지가 '다음' */
const BACK_ZONE = 0.3;

const IMAGES = [
  require('../assets/onboarding/onboarding1.jpg'),
  require('../assets/onboarding/onboarding2.jpg'),
  require('../assets/onboarding/onboarding3.jpg'),
  require('../assets/onboarding/onboarding4.jpg'),
  require('../assets/onboarding/onboarding5.jpg'),
  require('../assets/onboarding/onboarding6.jpg'),
  require('../assets/onboarding/onboarding7.jpg'),
  require('../assets/onboarding/onboarding8.jpg'),
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goTo = (index: number) => {
    flatListRef.current?.scrollToIndex({index});
    setCurrentIndex(index);
  };

  const goNext = async () => {
    if (currentIndex < IMAGES.length - 1) {
      goTo(currentIndex + 1);
      return;
    }
    await markOnboardingDone();
    router.replace('/(main)/(tabs)/home');
  };

  // 첫 장에서는 돌아갈 곳이 없다 — 아무 일도 하지 않는다
  const goBack = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  };

  return (
    <View style={{flex: 1, backgroundColor: '#000'}}>
      <FlatList
        ref={flatListRef}
        data={IMAGES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({item}) => (
          <Image source={item} style={{width, height, resizeMode: 'cover'}} />
        )}
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
