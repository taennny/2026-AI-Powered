/**
 * @file components/home/HomeFooter.tsx
 * @description 홈 하단 푸터 컴포넌트
 *
 * ## 다음 연결 작업
 * - [ ] 이동 거리 실제 데이터 연결 (선택 날짜 기준)
 * - [ ] 글쓰기 버튼 router.push('/(main)/write') 연결
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function HomeFooter() {
  const handleWritePress = () => {
    // TODO: 글쓰기 라우터 연결
  };

  return (
    <SafeAreaView edges={['bottom']} style={{backgroundColor: '#F6F6F6'}}>
      <View
        style={{backgroundColor: '#F6F6F6'}}
        className="flex-row items-center justify-between px-5 py-3"
      >
        <View>
          <Text style={{fontSize: 11, color: '#999', marginBottom: 2}}>
            이동 거리
          </Text>
          <Text style={{fontSize: 18, fontWeight: '600', color: '#1a1a1a'}}>
            0.0Km
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleWritePress}
          style={{
            backgroundColor: '#1a1a1a',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <Text
            style={{
              color: '#fff',
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
