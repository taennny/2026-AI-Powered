/**
 * 탭 공통 레이아웃 (home, journal-list에만 적용)
 * - 헤더, 네비게이션 탭, 푸터를 공통으로 렌더링
 * - Slot 자리에 home/index.tsx 또는 journal-list/index.tsx 내용이 들어옴
 * - write, write-preview 등 (tabs) 밖 화면에는 적용되지 않음
 * - HomeFooter는 home 화면에서만 표시 (journal-list에서는 숨김)
 */

import {View} from 'react-native';
import {Slot, usePathname} from 'expo-router';

import HomeHeader from '@/components/home/HomeHeader';
import SectionTabs from '@/components/home/SectionTabs';
import HomeFooter from '@/components/home/HomeFooter';

export default function TabsLayout() {
  const pathname = usePathname();
  const isHome = pathname.includes('/home');

  return (
    <View style={{flex: 1}}>
      <HomeHeader />
      <SectionTabs />
      {/* Slot(=바텀시트 포함 화면)을 flex-1 박스로 한정 → 바텀시트 base가 푸터 위에서 끝남 */}
      <View style={{flex: 1}}>
        <Slot />
      </View>
      {isHome && <HomeFooter />}
    </View>
  );
}
