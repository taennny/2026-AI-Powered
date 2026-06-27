import {useEffect, useState} from 'react';
import {Alert, View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {fetchSubscription, subscribePremium, cancelSubscription, type SubscriptionStatus} from '@/services/subscriptionApi';
import {useThemeStore} from '@/store/themeStore';
import PremiumView from '@/components/subscription/PremiumView';
import FreeView from '@/components/subscription/FreeView';

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function SubscriptionScreen() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const setTheme = useThemeStore(s => s.setTheme);

  useEffect(() => {
    fetchSubscription()
      .then(setSubscription)
      .catch(() => {
        setSubscription({plan: 'free', started_at: null, expires_at: null, is_active: false});
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = () => {
    Alert.alert(
      '프리미엄 구독',
      '로미 프리미엄을 시작할까요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '확인',
          onPress: async () => {
            try {
              await subscribePremium();
              // 백엔드에서 최신 구독 상태 조회
              const updated = await fetchSubscription();
              setSubscription(updated);
              Alert.alert('', '결제가 완료되었습니다.');
            } catch {
              Alert.alert('오류', '구독 처리 중 문제가 발생했어요. 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      '구독 해지',
      '정말 로미 프리미엄을 해지하겠어요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '해지',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              // 백엔드에서 최신 구독 상태 조회
              const updated = await fetchSubscription();
              setSubscription(updated);
              // 테마를 베이직으로 변경
              setTheme('basic');
              Alert.alert('', '구독이 해지되었습니다.');
            } catch {
              Alert.alert('오류', '구독 해지 중 문제가 발생했어요. 다시 시도해주세요.');
            }
          },
        },
      ],
    );
  };

  const isPremium = subscription?.plan === 'premium' && subscription?.is_active;

  const subtitle = !isPremium
    ? '베이직 플랜을 이용 중'
    : subscription?.expires_at
      ? `프리미엄 플랜을 이용 중 - 다음 결제일 : ${formatMonthDay(subscription.expires_at)}`
      : '프리미엄 플랜을 이용 중';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">

      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">구독</Text>
        {!loading && (
          <Text className="text-[13px] text-secondary mt-1">{subtitle}</Text>
        )}
      </View>

      {/* 구분선 */}
      <View className="h-px bg-line" />

      {/* 콘텐츠 */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : isPremium && subscription ? (
        <PremiumView subscription={subscription} onCancel={handleCancel} />
      ) : (
        <FreeView onSubscribe={handleSubscribe} />
      )}

    </SafeAreaView>
  );
}
