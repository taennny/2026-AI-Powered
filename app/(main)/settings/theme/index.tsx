/**
 * @file app/(main)/settings/theme/index.tsx
 * @description 테마 설정 화면
 * - 수평 스크롤 캐러셀로 테마 선택
 * - 베이직 / 다크 / 딸기 / 아쿠아
 *
 * ## 다음 연결 작업
 * - [ ] 선택된 테마를 전역 store에 저장 후 앱 전체 적용
 * - [ ] 각 테마 미리보기 실제 스크린샷으로 교체
 * - [ ] 구독하기 버튼 → 결제 플로우 연결
 */

import {useRef, useState} from 'react';
import {View, Text, TouchableOpacity, FlatList, Dimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';
import {fetchSubscription} from '@/services/subscriptionApi';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';

const SCREEN_WIDTH = Dimensions.get('window').width;

const THEMES = [
  {
    id: 'basic',
    label: '베이직',
    bg: '#E6F0F1',
    accent: '#7BBFD4',
    bar: '#D8E6E8',
  },
  {
    id: 'dark',
    label: '다크',
    bg: '#1e1e1e',
    accent: '#4a9eba',
    bar: '#2e2e2e',
  },
  {
    id: 'strawberry',
    label: '딸기',
    bg: '#FFE4EC',
    accent: '#F472B6',
    bar: '#FBCFE8',
  },
  {
    id: 'aqua',
    label: '아쿠아',
    bg: '#E0F4FF',
    accent: '#38BDF8',
    bar: '#BAE6FD',
  },
] as const;

type ThemeId = (typeof THEMES)[number]['id'];

export default function ThemeScreen() {
  const [selected, setSelected] = useState<ThemeId>('basic');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const PREMIUM_THEMES: ThemeId[] = ['strawberry', 'aqua'];

  const handleSelect = async (id: ThemeId) => {
    if (!PREMIUM_THEMES.includes(id)) {
      setSelected(id);
      return;
    }
    try {
      const sub = await fetchSubscription();
      if (sub.plan === 'premium' && sub.is_active) {
        setSelected(id);
      } else {
        setShowModal(true);
      }
    } catch {
      // 401(미인증) 또는 네트워크 오류 → 미구독으로 처리
      setShowModal(true);
    }
  };

  const PREVIEW_H = SCREEN_WIDTH * 1.1;
  const LIST_H = PREVIEW_H + 60; // 패딩 + 라벨 행 높이

  return (
    <SafeAreaView
      edges={['top']}
      style={{flex: 1, backgroundColor: Colors.surface}}
    >
      {/* 헤더 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: Colors.surface,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
          <Text style={{fontSize: 22, fontWeight: '400', color: '#CCCCCC'}}>
            {'<'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <Text
        style={{
          fontSize: 36,
          fontWeight: '800',
          color: Colors.textPrimary,
          paddingHorizontal: 24,
          paddingBottom: 16,
        }}
      >
        테마
      </Text>

      {/* 구분선 */}
      <View
        style={{
          height: 1,
          backgroundColor: Colors.borderLight,
          marginHorizontal: 0,
        }}
      />

      {/* 캐러셀 */}
      <FlatList
        ref={flatListRef}
        data={THEMES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{height: LIST_H, flexGrow: 0}}
        onMomentumScrollEnd={e => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
          );
          setCurrentIndex(index);
        }}
        renderItem={({item}) => (
          <View
            style={{width: SCREEN_WIDTH, paddingHorizontal: 20, paddingTop: 20}}
          >
            {/* 라디오 + 테마명 — 왼쪽 정렬, 미리보기보다 안쪽 */}
            <TouchableOpacity
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingLeft: 12,
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: Colors.textTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected === item.id && (
                  <View
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: 6,
                      backgroundColor: Colors.textPrimary,
                    }}
                  />
                )}
              </View>
              <Text style={{fontSize: 15, color: Colors.textPrimary}}>
                {item.label}
              </Text>
            </TouchableOpacity>

            {/* 미리보기 카드 — 내용 비움 (추후 스크린샷으로 교체) */}
            <View
              style={{
                height: PREVIEW_H,
                borderRadius: 24,
                backgroundColor: item.bg,
              }}
            />
          </View>
        )}
      />

      {/* 페이지네이션 닷 — 미리보기 바로 아래 */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 12,
        }}
      >
        {THEMES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentIndex ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor:
                i === currentIndex ? Colors.textPrimary : Colors.borderLight,
            }}
          />
        ))}
      </View>

      <SubscriptionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </SafeAreaView>
  );
}
