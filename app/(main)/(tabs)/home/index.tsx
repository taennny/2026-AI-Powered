/**
 * @file app/(main)/(tabs)/home/index.tsx
 * @description 홈 인덱스 화면
 * - 배경: Calendar 컴포넌트 (미연결)
 * - 전경: BottomSheet 컴포넌트 (드래그로 peek ↔ expanded 전환)
 *
 * ## 레이아웃 구조
 * (tabs)/_layout.tsx
 *   └─ HomeHeader
 *   └─ SectionTabs
 *   └─ [Slot] → 이 파일 (HomeIndex)
 *        └─ Calendar (배경, TODO)
 *        └─ BottomSheet (absolute, 전경)
 *   └─ HomeFooter
 *
 * ## 다음 연결 작업
 * - [ ] Calendar 컴포넌트 연결 (선택 날짜 → BottomSheet 날짜 헤더에 전달)
 * - [ ] BottomSheet children으로 날짜 헤더 + PostCard 리스트 연결
 * - [ ] 선택 날짜 상태(selectedDate)를 상위 또는 zustand store로 관리 검토
 */

import {View} from 'react-native';

import BottomSheet from '@/components/bottomsheet/BottomSheet';

export default function HomeIndex() {
  return (
    // position: relative 컨테이너 — BottomSheet의 absolute 기준점
    <View style={{flex: 1, backgroundColor: '#FFFFFF'}}>
      {/* TODO: Calendar 컴포넌트 — 선택된 날짜를 BottomSheet에 전달 */}

      {/* BottomSheet는 absolute로 배치되어 Calendar 위에 오버레이됨 */}
      <BottomSheet />
    </View>
  );
}
