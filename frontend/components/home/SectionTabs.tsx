import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {useRef, useEffect, useState} from 'react';
import {router, usePathname} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';

type Tab = 'home' | 'journal';

const ACTIVE_FLEX = 52;
const INACTIVE_FLEX = 48;

/** 경로가 어느 탭에 속하는지. 탭 밖 화면이면 null */
function tabOf(pathname: string): Tab | null {
  if (pathname.includes('journal')) return 'journal';
  if (pathname.includes('home')) return 'home';
  return null;
}

export default function SectionTabs() {
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<Tab>(
    () => tabOf(pathname) ?? 'home',
  );

  const requestRefresh = useTimelineStore(state => state.requestRefresh);

  const homeFlex = useRef(
    new Animated.Value(
      activeTab === 'home' ? ACTIVE_FLEX : INACTIVE_FLEX,
    ),
  ).current;

  const journalFlex = useRef(
    new Animated.Value(
      activeTab === 'journal' ? ACTIVE_FLEX : INACTIVE_FLEX,
    ),
  ).current;

  useEffect(() => {
    const tab = tabOf(pathname);

    if (tab) {
      setActiveTab(tab);
    }
  }, [pathname]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(homeFlex, {
        toValue: activeTab === 'home' ? ACTIVE_FLEX : INACTIVE_FLEX,
        useNativeDriver: false,
        tension: 38,
        friction: 14,
      }),
      Animated.spring(journalFlex, {
        toValue: activeTab === 'journal' ? ACTIVE_FLEX : INACTIVE_FLEX,
        useNativeDriver: false,
        tension: 38,
        friction: 14,
      }),
    ]).start();
  }, [activeTab, homeFlex, journalFlex]);

  const handleTabPress = (tab: Tab) => {
    if (tab === activeTab) {
      if (tab === 'home') {
        requestRefresh();
      }

      return;
    }

    if (tab === 'home') {
      router.replace('/(main)/(tabs)/home');
    } else {
      router.replace('/(main)/(tabs)/journal-list');
    }
  };

  return (
    <View className="bg-surface flex-row pt-2">
      <Animated.View
        style={{
          flex: homeFlex,
          zIndex: activeTab === 'home' ? 1 : 0,
        }}
      >
       <TouchableOpacity
  onPress={() => handleTabPress('home')}
  className="items-center bg-card rounded-tr-[10px] py-3"
  style={{
    boxShadow:
      activeTab === 'home'
        ? '4px -3px 9px -3px rgba(0,0,0,0.10)'
        : '0 -2px 6px -3px rgba(0,0,0,0.06)',
  }}
>
  <Text
  className={`text-[13px] tracking-[0.3px] ${
    activeTab === 'home'
      ? 'font-semibold text-primary'
      : 'font-normal text-secondary'
  }`}
/>
</TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={{
          flex: journalFlex,
          zIndex: activeTab === 'journal' ? 1 : 0,
        }}
      >
       <TouchableOpacity
  onPress={() => handleTabPress('journal')}
  className="items-center bg-teal rounded-tl-[10px] py-3"
  style={{
    boxShadow:
      activeTab === 'journal'
        ? '-4px -3px 9px -3px rgba(0,0,0,0.10)'
        : '0 -2px 6px -3px rgba(0,0,0,0.06)',
  }}
>
  <Text
  className={`text-[13px] tracking-[0.3px] ${
    activeTab === 'journal'
      ? 'font-semibold text-primary'
      : 'font-normal text-secondary'
  }`}
/>
</TouchableOpacity>
      </Animated.View>
    </View>
  );
}