/**
 * @file onboarding.tsx
 * @description 온보딩 화면 — 최초 로그인 시 3페이지 안내 후 홈으로 이동
 * - 터치 시 다음 페이지로 이동, 마지막 페이지에서 홈으로 이동
 * - AsyncStorage에 'onboarding_done' 키를 저장하여 재진입 시 건너뜀
 */

import {useState, useRef} from 'react';
import {
  View,
  Image,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
} from 'react-native';
import {router} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {width, height} = Dimensions.get('window');

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

  const handleTouch = async () => {
    if (currentIndex < IMAGES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({index: next});
      setCurrentIndex(next);
    } else {
      await AsyncStorage.setItem('onboarding_done', 'true');
      router.replace('/(main)/(tabs)/home');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
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
      </View>
    </TouchableWithoutFeedback>
  );
}
