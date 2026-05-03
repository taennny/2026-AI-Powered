/**
 * @file app/(main)/settings/theme/index.tsx — 테마 선택 화면
 *
 * ## 다음 연결 작업
 * - [ ] 각 테마 미리보기 실제 스크린샷으로 교체
 * - [ ] 구독하기 버튼 → 결제 플로우 연결
 */

import {useRef} from 'react';
import {View, Text, TouchableOpacity, FlatList, Dimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {fetchSubscription} from '@/services/subscriptionApi';
import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import {useThemeStore} from '@/store/themeStore';
import {type ThemeId} from '@/constants/themes';
import {useState} from 'react';

const SCREEN_WIDTH = Dimensions.get('window').width;

const THEMES = [
  {id: 'basic'      as ThemeId, label: '베이직',  bg: '#E6F0F1'},
  {id: 'dark'       as ThemeId, label: '다크',    bg: '#1e1e1e'},
  {id: 'strawberry' as ThemeId, label: '딸기',    bg: '#FFE4EC'},
  {id: 'aqua'       as ThemeId, label: '아쿠아',  bg: '#E0F4FF'},
];

const PREMIUM_THEMES: ThemeId[] = ['strawberry', 'aqua'];

export default function ThemeScreen() {
  const {themeId, setTheme} = useThemeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const PREVIEW_H = SCREEN_WIDTH * 1.1;
  const LIST_H = PREVIEW_H + 60;

  const handleSelect = async (id: ThemeId) => {
    if (!PREMIUM_THEMES.includes(id)) {
      setTheme(id);
      return;
    }
    try {
      const sub = await fetchSubscription();
      if (sub.plan === 'premium' && sub.is_active) {
        setTheme(id);
      } else {
        setShowModal(true);
      }
    } catch {
      setShowModal(true);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">

      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <Text className="text-[36px] font-extrabold text-primary px-6 pb-4">테마</Text>

      {/* 구분선 */}
      <View className="h-px bg-line" />

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
          setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        }}
        renderItem={({item}) => (
          <View style={{width: SCREEN_WIDTH}} className="px-5 pt-5">
            <TouchableOpacity
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.7}
              className="flex-row items-center gap-x-[10px] pl-3 mb-[14px]"
            >
              <View className="w-5 h-5 rounded-full border-[1.5px] border-tertiary items-center justify-center">
                {themeId === item.id && (
                  <View className="w-[11px] h-[11px] rounded-full bg-primary" />
                )}
              </View>
              <Text className="text-[15px] text-primary">{item.label}</Text>
            </TouchableOpacity>

            {/* 미리보기 (추후 스크린샷으로 교체) */}
            <View style={{height: PREVIEW_H, borderRadius: 24, backgroundColor: item.bg}} />
          </View>
        )}
      />

      {/* 페이지네이션 닷 */}
      <View className="flex-row justify-center gap-x-[6px] py-3">
        {THEMES.map((_, i) => (
          <View
            key={i}
            className={`h-[6px] rounded-full ${i === currentIndex ? 'w-4 bg-primary' : 'w-[6px] bg-line'}`}
          />
        ))}
      </View>

      <SubscriptionModal visible={showModal} onClose={() => setShowModal(false)} />

    </SafeAreaView>
  );
}
