/**
 * @file components/home/HomeFooter.tsx
 * @description 홈 하단 푸터 컴포넌트
 * - 이동 거리: timelineStore에서 읽음
 * - 글쓰기 버튼: /(main)/write 이동
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';
import {useTimelineStore} from '@/store/timelineStore';

export default function HomeFooter() {
  const totalDistance = useTimelineStore(s => s.totalDistance);

  const handleWritePress = () => {
    router.push('/(main)/write');
  };

  return (
    <SafeAreaView edges={['bottom']} style={{backgroundColor: Colors.surface}}>
      <View
        style={{backgroundColor: Colors.surface}}
        className="flex-row items-center justify-between px-5 py-3"
      >
        <View>
          <Text style={{fontSize: 11, color: Colors.textTertiary, marginBottom: 2}}>
            이동 거리
          </Text>
          <Text style={{fontSize: 18, fontWeight: '600', color: Colors.textPrimary}}>
            {totalDistance.toFixed(1)}Km
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleWritePress}
          style={{
            backgroundColor: Colors.textPrimary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: Colors.white,
              fontSize: 13,
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            글쓰기
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
