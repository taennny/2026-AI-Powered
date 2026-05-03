/**
 * @file components/home/HomeFooter.tsx — 홈 하단 푸터 (이동 거리 + 글쓰기 버튼)
 * - 이동 거리: timelineStore에서 읽음
 * - 글쓰기 버튼: /(main)/write 이동
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';

export default function HomeFooter() {
  const totalDistance = useTimelineStore(s => s.totalDistance);

  return (
    <SafeAreaView edges={['bottom']} className="bg-surface">
      <View className="flex-row items-center justify-between px-5 py-3 bg-surface">
        <View>
          <Text className="text-[11px] text-tertiary mb-0.5">이동 거리</Text>
          <Text className="text-lg font-semibold text-primary">{totalDistance.toFixed(1)}Km</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(main)/write')}
          className="bg-primary px-5 py-[10px] rounded-[20px]"
        >
          <Text className="text-white text-[13px] font-semibold tracking-[0.5px]">글쓰기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
