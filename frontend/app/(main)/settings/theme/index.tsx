import {useRef} from 'react';
import {View, Text, TouchableOpacity, FlatList, Dimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {useState} from 'react';

import SubscriptionModal from '@/components/subscription/SubscriptionModal';
import {useSubscriptionStore} from '@/store/subscriptionStore';
import {useThemeStore} from '@/store/themeStore';
import {PREMIUM_THEMES, type ThemeId} from '@/constants/themes';

const SCREEN_WIDTH = Dimensions.get('window').width;

const THEMES = [
  {id: 'basic' as ThemeId, label: '베이직', bg: '#E6F0F1'},
  {id: 'dark' as ThemeId, label: '다크', bg: '#1e1e1e'},
  {id: 'strawberry' as ThemeId, label: '딸기', bg: '#FFE4EC'},
  {id: 'aqua' as ThemeId, label: '아쿠아', bg: '#E0F4FF'},
];

export default function ThemeScreen() {
  const {themeId, setTheme} = useThemeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const PREVIEW_H = SCREEN_WIDTH * 1.1;
  const LIST_H = PREVIEW_H + 60;

  // 구독 조회는 useSubscriptionSync가 미리 해둔다 — 탭할 때마다 왕복하지 않는다.
  // 조회에 실패했으면 store가 free로 떨어져 있어 잠금이 유지된다.
  const isPremium = useSubscriptionStore(s => s.isPremium());

  const handleSelect = (id: ThemeId) => {
    if (PREMIUM_THEMES.includes(id) && !isPremium) {
      setShowModal(true);
      return;
    }
    setTheme(id);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-[36px] font-extrabold text-primary px-6 pb-4">
        테마
      </Text>

      <View className="h-px bg-line" />

      <FlatList
        ref={flatListRef}
        data={THEMES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{height: LIST_H, flexGrow: 0}}
        onMomentumScrollEnd={e => {
          setCurrentIndex(
            Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
          );
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

            {/* 예시 영역도 선택에 쓴다 — 미리보기를 보다가 바로 고르는 게 자연스럽다.
                가로 스와이프는 TouchableOpacity가 탭만 잡으므로 그대로 동작한다 */}
            <TouchableOpacity
              onPress={() => handleSelect(item.id)}
              activeOpacity={0.7}
              style={{
                height: PREVIEW_H,
                borderRadius: 24,
                backgroundColor: item.bg,
              }}
            />
          </View>
        )}
      />

      <View className="flex-row justify-center gap-x-[6px] py-3">
        {THEMES.map((_, i) => (
          <View
            key={i}
            className={`h-[6px] rounded-full ${i === currentIndex ? 'w-4 bg-primary' : 'w-[6px] bg-line'}`}
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
