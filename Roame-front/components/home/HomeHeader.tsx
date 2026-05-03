/** @file components/home/HomeHeader.tsx — 홈 상단 헤더 (설정 버튼) */

import {View, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

export default function HomeHeader() {
  return (
    <SafeAreaView edges={['top']} className="bg-surface">
      <View className="flex-row items-center justify-end px-5 py-3 bg-surface">
        <TouchableOpacity onPress={() => router.push('/(main)/settings')} className="p-1 gap-y-[5px]">
          <View className="w-[22px] h-[1.5px] bg-muted" />
          <View className="w-[22px] h-[1.5px] bg-muted" />
          <View className="w-[22px] h-[1.5px] bg-muted" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
