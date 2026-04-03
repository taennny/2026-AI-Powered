/**
 * @file components/home/SectionTabs.tsx
 * @description 홈 네비게이션 탭 컴포넌트
 * - Index(home) / Journal List 탭 전환
 * - Index 탭: 항상 #FFFFFF 고정 / Journal List 탭: 항상 #D8E6E8 고정
 * - 활성 탭이 위로 올라오는 spring 애니메이션 + shadow로 앞에 뜨는 카드 효과
 * - 비활성 탭은 활성 탭 뒤에 깔리는 구조 (zIndex로 레이어 제어)
 */

import {View, Text, TouchableOpacity, Animated} from 'react-native';
import {useRef, useState} from 'react';
import {router} from 'expo-router';

type Tab = 'home' | 'journal';

export default function SectionTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const homeAnim = useRef(new Animated.Value(0)).current;
  const journalAnim = useRef(new Animated.Value(0)).current;

  const handleTabPress = (tab: Tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);

    Animated.parallel([
      Animated.spring(homeAnim, {
        toValue: tab === 'home' ? -4 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.spring(journalAnim, {
        toValue: tab === 'journal' ? -4 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
    ]).start();

    if (tab === 'home') {
      router.replace('/(main)/(tabs)/home');
    } else {
      router.replace('/(main)/(tabs)/journal-list');
    }
  };

  return (
    <View style={{backgroundColor: 'transparent', flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8}}>
      {/* Index 탭 — 항상 흰색, 활성 시 앞으로 올라옴 */}
      <Animated.View
        style={{
          flex: 1,
          zIndex: activeTab === 'home' ? 2 : 1,
          transform: [{translateY: homeAnim}],
          // 활성 탭에만 shadow 적용해 카드가 떠 있는 느낌
          shadowColor: '#000',
          shadowOffset: {width: 0, height: activeTab === 'home' ? -2 : 0},
          shadowOpacity: activeTab === 'home' ? 0.08 : 0,
          shadowRadius: 4,
          elevation: activeTab === 'home' ? 4 : 0,
        }}
      >
        <TouchableOpacity
          onPress={() => handleTabPress('home')}
          style={{
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'home' ? '600' : '400',
              color: activeTab === 'home' ? '#1a1a1a' : '#6b7280',
              letterSpacing: 0.3,
            }}
          >
            Index
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Journal List 탭 — 항상 #D8E6E8, 활성 시 앞으로 올라옴 */}
      <Animated.View
        style={{
          flex: 1,
          zIndex: activeTab === 'journal' ? 2 : 1,
          transform: [{translateY: journalAnim}],
          shadowColor: '#000',
          shadowOffset: {width: 0, height: activeTab === 'journal' ? -2 : 0},
          shadowOpacity: activeTab === 'journal' ? 0.08 : 0,
          shadowRadius: 4,
          elevation: activeTab === 'journal' ? 4 : 0,
        }}
      >
        <TouchableOpacity
          onPress={() => handleTabPress('journal')}
          style={{
            alignItems: 'center',
            backgroundColor: '#D8E6E8',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: activeTab === 'journal' ? '600' : '400',
              color: activeTab === 'journal' ? '#1a1a1a' : '#6b7280',
              letterSpacing: 0.3,
            }}
          >
            Journal List
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
