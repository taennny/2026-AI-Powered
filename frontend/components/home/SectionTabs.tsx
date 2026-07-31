/**
 * 홈 네비게이션 탭 (Home ↔ Journal List)
 * - 활성 탭 52% / 비활성 48% spring 너비 애니메이션
 * - 활성 탭에 boxShadow 카드 효과
 */

import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {useRef, useEffect} from 'react';
import {router, usePathname} from 'expo-router';

import {useTimelineStore} from '@/store/timelineStore';

type Tab = 'home' | 'journal';

const ACTIVE_FLEX = 52;
const INACTIVE_FLEX = 48;

export default function SectionTabs() {
  const pathname = usePathname();
  const activeTab: Tab = pathname.includes('journal') ? 'journal' : 'home';
  const requestRefresh = useTimelineStore(s => s.requestRefresh);
  const homeFlex = useRef(
    new Animated.Value(activeTab === 'home' ? ACTIVE_FLEX : INACTIVE_FLEX),
  ).current;
  const journalFlex = useRef(
    new Animated.Value(activeTab === 'journal' ? ACTIVE_FLEX : INACTIVE_FLEX),
  ).current;

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
  }, [activeTab]);

  const handleTabPress = (tab: Tab) => {
    if (tab === activeTab) {
      // 이미 홈이면 이동 대신 새로고침 — 탭을 눌렀는데 아무 반응이 없는 것을 막는다
      if (tab === 'home') requestRefresh();
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
        style={{flex: homeFlex, zIndex: activeTab === 'home' ? 1 : 0}}
      >
        <TouchableOpacity
          onPress={() => handleTabPress('home')}
          className="items-center bg-card rounded-tl-[10px] rounded-tr-[10px] py-2"
          style={{
            boxShadow:
              activeTab === 'home'
                ? '3px -2px 6px rgba(0,0,0,0.09)'
                : '0 -1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Text
            className={`text-[13px] tracking-[0.3px] ${activeTab === 'home' ? 'font-semibold text-primary' : 'font-normal text-secondary'}`}
          />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={{flex: journalFlex, zIndex: activeTab === 'journal' ? 1 : 0}}
      >
        <TouchableOpacity
          onPress={() => handleTabPress('journal')}
          className="items-center bg-teal rounded-tl-[10px] rounded-tr-[10px] py-2"
          style={{
            boxShadow:
              activeTab === 'journal'
                ? '-3px -2px 6px rgba(0,0,0,0.09)'
                : '0 -1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Text
            className={`text-[13px] tracking-[0.3px] ${activeTab === 'journal' ? 'font-semibold text-primary' : 'font-normal text-secondary'}`}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
