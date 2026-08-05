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

  /**
   * 탭 밖 화면(write-preview·write·settings)에서는 마지막 탭을 유지한다.
   *
   * (tabs) 레이아웃은 Stack에서 언마운트되지 않고 뒤에 살아남아 pathname 변화에
   * 계속 반응한다. 예전에는 'journal이 아니면 home'으로 판정해서, 저널 목록에서
   * 글을 누르는 순간 탭 포커스가 홈으로 튀었다.
   */
  const [activeTab, setActiveTab] = useState<Tab>(() => tabOf(pathname) ?? 'home');

  useEffect(() => {
    const tab = tabOf(pathname);
    if (tab) setActiveTab(tab);
  }, [pathname]);
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
  }, [activeTab, homeFlex, journalFlex]);

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
          className="items-center bg-card rounded-tr-[10px] py-3"
          style={{
            // spread 음수로 아래 방향 번짐을 없앤다 — 콘텐츠와 맞닿는 쪽에는
            // 그림자가 보이지 않아야 탭이 화면에 이어 붙은 것처럼 보인다
            boxShadow:
              activeTab === 'home'
                ? '4px -3px 9px -3px rgba(0,0,0,0.10)'
                : '0 -2px 6px -3px rgba(0,0,0,0.06)',
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
          className="items-center bg-teal rounded-tl-[10px] py-3"
          style={{
            boxShadow:
              activeTab === 'journal'
                ? '-4px -3px 9px -3px rgba(0,0,0,0.10)'
                : '0 -2px 6px -3px rgba(0,0,0,0.06)',
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
