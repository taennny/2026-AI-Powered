/**
 * @file components/home/SectionTabs.tsx
 * @description 홈 네비게이션 탭 컴포넌트
 * - Index(home) / Journal List 탭 전환
 * - Index 탭: 항상 #FFFFFF 고정 / Journal List 탭: 항상 #D8E6E8 고정
 * - 활성 탭 58% / 미선택 탭 42% spring 너비 애니메이션
 * - 활성 탭에 boxShadow로 앞에 뜨는 카드 효과
 */

import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {useState, useRef} from 'react';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';

type Tab = 'home' | 'journal';

const ACTIVE_FLEX = 52;
const INACTIVE_FLEX = 48;

export default function SectionTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  // homeFlex: home 탭의 flex 값 (42 ↔ 58)
  const homeFlex = useRef(new Animated.Value(ACTIVE_FLEX)).current;

  const handleTabPress = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);

    Animated.spring(homeFlex, {
      toValue: tab === 'home' ? ACTIVE_FLEX : INACTIVE_FLEX,
      useNativeDriver: false,
      tension: 38,
      friction: 14,
    }).start();

    if (tab === 'home') {
      router.replace('/(main)/(tabs)/home');
    } else {
      router.replace('/(main)/(tabs)/journal-list');
    }
  };

  const journalFlex = homeFlex.interpolate({
    inputRange: [INACTIVE_FLEX, ACTIVE_FLEX],
    outputRange: [ACTIVE_FLEX, INACTIVE_FLEX],
  });

  return (
    <View
      style={{
        backgroundColor: Colors.surface,
        flexDirection: 'row',
        paddingTop: 8,
      }}
    >
      {/* 활성 탭은 zIndex: 1로 올려서 그림자가 비활성 탭 위에 드리워지게 함 */}
      <Animated.View style={{flex: homeFlex, zIndex: activeTab === 'home' ? 1 : 0}}>
        <TouchableOpacity
          onPress={() => handleTabPress('home')}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.white,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingVertical: 8,
            boxShadow: activeTab === 'home'
              ? '3px -2px 6px rgba(0,0,0,0.09)'   // 오른쪽(journal 탭 방향)으로 그림자
              : '0 -1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'home' ? '600' : '400',
              color: activeTab === 'home' ? Colors.textPrimary : Colors.textSecondary,
              letterSpacing: 0.3,
            }}
          ></Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{flex: journalFlex, zIndex: activeTab === 'journal' ? 1 : 0}}>
        <TouchableOpacity
          onPress={() => handleTabPress('journal')}
          style={{
            alignItems: 'center',
            backgroundColor: '#D8E6E8',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingVertical: 8,
            boxShadow: activeTab === 'journal'
              ? '-3px -2px 6px rgba(0,0,0,0.09)'  // 왼쪽(home 탭 방향)으로 그림자
              : '0 -1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'journal' ? '600' : '400',
              color: activeTab === 'journal' ? Colors.textPrimary : Colors.textSecondary,
              letterSpacing: 0.3,
            }}
          ></Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
