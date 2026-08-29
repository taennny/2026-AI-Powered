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
      <View style={{flex: 1}}>
        <Slot />
      </View>
      {isHome && <HomeFooter />}
    </View>
  );
}
