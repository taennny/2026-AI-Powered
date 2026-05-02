/**
 * @file app/(main)/settings/subscription/index.tsx
 * @description 구독 설정 화면
 * - API 응답에 따라 PremiumView / FreeView 분기
 */

import {useEffect, useState} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';
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
        // 401 또는 네트워크 오류 → 무료 플랜으로 처리
        setSubscription({plan: 'free', started_at: null, expires_at: null, is_active: false});
      })
      .finally(() => setLoading(false));
  }, []);

  const isPremium = subscription?.plan === 'premium' && subscription?.is_active;

  const subtitle = isPremium && subscription?.started_at
    ? `프리미엄 플랜을 이용 중 - 다음 결제일 : ${getNextPaymentDate(subscription.started_at)}`
    : '베이직 플랜을 이용 중';

  return (
    <SafeAreaView edges={['top']} style={{flex: 1, backgroundColor: Colors.surface}}>
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
          <Text style={{fontSize: 22, fontWeight: '400', color: '#CCCCCC'}}>{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View style={{paddingHorizontal: 24, paddingBottom: 16}}>
        <Text style={{fontSize: 36, fontWeight: '800', color: Colors.textPrimary}}>
          구독
        </Text>
        {!loading && (
          <Text style={{fontSize: 13, color: Colors.textSecondary, marginTop: 4}}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* 구분선 */}
      <View style={{height: 1, backgroundColor: Colors.borderLight}} />

      {/* 콘텐츠 */}
      {loading ? (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size="small" color={Colors.tealDark} />
        </View>
      ) : isPremium && subscription ? (
        <PremiumView subscription={subscription} />
      ) : (
        <FreeView />
      )}
    </SafeAreaView>
  );
}
