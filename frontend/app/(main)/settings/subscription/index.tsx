/** @file app/(main)/settings/subscription/index.tsx — 구독 설정 화면 (플랜 조회 + Premium/Free 분기) */

import {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {fetchSubscription, type SubscriptionStatus} from '@/services/subscriptionApi';
import PremiumView from '@/components/subscription/PremiumView';
import FreeView from '@/components/subscription/FreeView';

function getNextPaymentDate(startedAt: string): string {
  const next = new Date(startedAt);
  next.setDate(next.getDate() + 30);
  return `${next.getMonth() + 1}월 ${next.getDate()}일`;
}

export default function SubscriptionScreen() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription()
      .then(setSubscription)
      .catch(() => {
        setSubscription({plan: 'free', started_at: null, expires_at: null, is_active: false});
      })
      .finally(() => setLoading(false));
  }, []);

  const isPremium = subscription?.plan === 'premium' && subscription?.is_active;

  const subtitle = isPremium && subscription?.started_at
    ? `프리미엄 플랜을 이용 중 - 다음 결제일 : ${getNextPaymentDate(subscription.started_at)}`
    : '베이직 플랜을 이용 중';

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
        <PremiumView subscription={subscription} />
      ) : (
        <FreeView />
      )}

    </SafeAreaView>
  );
}
