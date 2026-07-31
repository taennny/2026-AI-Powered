import {useState, useRef} from 'react';
import {
  View,
  Image,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
} from 'react-native';
import {router} from 'expo-router';

import {markOnboardingDone} from '@/utils/onboardingStorage';

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
      await markOnboardingDone();
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
