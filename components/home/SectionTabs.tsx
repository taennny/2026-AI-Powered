/**
 * @file components/home/SectionTabs.tsx
 * @description 홈 네비게이션 탭 컴포넌트
 * - Index(home) / Journal List 탭 전환
 * - 선택된 탭이 위로 올라오는 spring 애니메이션 (수정 필요)
 * - 배경색: #D8E6E8 / 선택된 탭: #FFFFFF (수정 필요, 색 변경되지 않음)
 *
 * ## 다음 연결 작업
 * - [ ] 탭 추가 시 Tab 타입과 handleTabPress 분기 확장
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
    <View style={{backgroundColor: '#D8E6E8'}} className="flex-row px-4 pt-2">
      {/* Index 탭 */}
      <Animated.View style={{transform: [{translateY: homeAnim}]}}>
        <TouchableOpacity
          onPress={() => handleTabPress('home')}
          style={{
            backgroundColor: activeTab === 'home' ? '#FFFFFF' : 'transparent',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingHorizontal: 20,
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

      {/* Journal List 탭 */}
      <Animated.View style={{transform: [{translateY: journalAnim}]}}>
        <TouchableOpacity
          onPress={() => handleTabPress('journal')}
          style={{
            backgroundColor:
              activeTab === 'journal' ? '#FFFFFF' : 'transparent',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            paddingHorizontal: 20,
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
