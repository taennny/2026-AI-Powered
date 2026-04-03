/**
 * @file app/(main)/(tabs)/journal-list/index.tsx
 * @description 섹션2 — 저널 리스트 화면
 * - 배경색: #D8E6E8 (SectionTabs 배경과 동일하게 맞춤)
 * - 바텀시트 없음
 *
 * ## 다음 연결 작업
 * - [ ] 검색 바 컴포넌트 연결
 * - [ ] JournalCard 리스트 연결
 */

import {View, Text} from 'react-native';

export default function JournalListScreen() {
  return (
    <View style={{flex: 1, backgroundColor: '#D8E6E8'}} className="items-center justify-center">
      <Text className="text-lg font-bold">여기는 저널 리스트 화면입니다</Text>
    </View>
  );
}
