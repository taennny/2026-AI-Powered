/**
 * @file components/home/HomeHeader.tsx
 * @description 홈 상단 헤더 컴포넌트
 *
 */

import {View, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';

export default function HomeHeader() {
  const handleMenuPress = () => {
    router.push('/(main)/settings');
  };

  return (
    <SafeAreaView edges={['top']} style={{backgroundColor: Colors.surface}}>
      <View
        style={{backgroundColor: Colors.surface}}
        className="flex-row items-center justify-end px-5 py-3"
      >
        <TouchableOpacity onPress={handleMenuPress} className="p-1 gap-y-[5px]">
          <View style={{width: 22, height: 1.5, backgroundColor: '#CCCCCC'}} />
          <View style={{width: 22, height: 1.5, backgroundColor: '#CCCCCC'}} />
          <View style={{width: 22, height: 1.5, backgroundColor: '#CCCCCC'}} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
