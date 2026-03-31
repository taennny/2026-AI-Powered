/**
 * @file components/home/HomeHeader.tsx
 * @description 홈 상단 헤더 컴포넌트
 *
 * ## 다음 연결 작업
 * - [ ] 햄버거 메뉴 버튼 → 설정 화면 연결
 */

import {View, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function HomeHeader() {
  const handleMenuPress = () => {
    // TODO: 설정 컴포넌트 연결
  };

  return (
    <SafeAreaView edges={['top']} style={{backgroundColor: '#F6F6F6'}}>
      <View
        style={{backgroundColor: '#F6F6F6'}}
        className="flex-row items-center justify-end px-5 py-3"
      >
        <TouchableOpacity onPress={handleMenuPress} className="p-1 gap-y-[5px]">
          <View style={{width: 22, height: 1.5, backgroundColor: '#333'}} />
          <View style={{width: 22, height: 1.5, backgroundColor: '#333'}} />
          <View style={{width: 22, height: 1.5, backgroundColor: '#333'}} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
