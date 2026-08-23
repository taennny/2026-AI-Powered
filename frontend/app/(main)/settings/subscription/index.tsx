import {useEffect, useState} from 'react';
import {
  Alert,
  Linking,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {APP_STORE_SUBSCRIPTIONS_URL} from '@/constants/store';
import {type BillingCycle} from '@/services/subscriptionApi';
import {
  getPurchaseOptions,
  isPurchaseAvailable,
  purchase,
  restorePurchases,
  type PurchaseOption,
} from '@/services/purchases';
import {useSubscriptionStore} from '@/store/subscriptionStore';
import PremiumView from '@/components/subscription/PremiumView';
import FreeView from '@/components/subscription/FreeView';

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function SubscriptionScreen() {
  // 갱신 시점은 useSubscriptionSync가 관리한다
  const subscription = useSubscriptionStore();
  const loading = !subscription.hasLoaded;
  const isPremium = subscription.isPremium();

  const [options, setOptions] = useState<PurchaseOption[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // 못 받아오면 FreeView가 국내 기준 기본값으로 그린다
  useEffect(() => {
    if (isPremium) return;
    void getPurchaseOptions().then(setOptions);
  }, [isPremium]);

  const priceLabels = Object.fromEntries(
    options.map(o => [o.cycle, o.priceString]),
  ) as Partial<Record<BillingCycle, string>>;

  /** 결제·복원 뒤 공통 처리 — 반영은 웹훅을 거쳐 몇 초 늦는다 */
  const syncAfterPurchase = async (successMessage: string) => {
    const applied = await useSubscriptionStore
      .getState()
      .refreshUntilChanged(false);

    Alert.alert(
      '',
      applied
        ? successMessage
        : '결제가 접수되었습니다. 반영까지 잠시 걸릴 수 있어요.',
    );
  };

  const handleSubscribe = async (billingCycle: BillingCycle) => {
    if (isPurchasing) return;

    if (!isPurchaseAvailable()) {
      Alert.alert('알림', '지금은 결제를 이용할 수 없어요.');
      return;
    }

    const option = options.find(o => o.cycle === billingCycle);
    if (!option) {
      Alert.alert(
        '알림',
        '상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
      );
      return;
    }

    setIsPurchasing(true);
    try {
      const result = await purchase(option.package);

      // 다이얼로그를 닫은 것 — 오류가 아니다
      if (result === 'cancelled') return;

      if (result === 'failed') {
        Alert.alert('오류', '결제에 실패했어요. 다시 시도해주세요.');
        return;
      }

      await syncAfterPurchase('결제가 완료되었습니다.');
    } finally {
      setIsPurchasing(false);
    }
  };

  /** 심사 필수 — 기기 변경·재설치 때 구독을 되찾는 경로 */
  const handleRestore = async () => {
    if (isPurchasing) return;

    setIsPurchasing(true);
    try {
      const ok = await restorePurchases();
      if (!ok) {
        Alert.alert('오류', '복원에 실패했어요. 다시 시도해주세요.');
        return;
      }

      const applied = await useSubscriptionStore
        .getState()
        .refreshUntilChanged(false);

      Alert.alert(
        '',
        applied
          ? '구독이 복원되었습니다.'
          : '복원할 구독을 찾지 못했어요. 결제한 Apple 계정으로 로그인했는지 확인해주세요.',
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  /** 해지는 앱스토어에서 — 우리 DB만 바꾸면 결제가 계속된다 */
  const handleCancel = () => {
    Alert.alert(
      '구독 해지',
      '구독 해지는 App Store에서 진행돼요.\n해지해도 남은 기간까지는 프리미엄을 그대로 쓸 수 있어요.',
      [
        {text: '닫기', style: 'cancel'},
        {
          text: '구독 관리 열기',
          onPress: () => {
            void Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL);
          },
        },
      ],
    );
  };

  /** 해지 예약 후에도 "다음 결제일"이라고 하면 또 해지하러 간다 */
  const subtitle = !isPremium
    ? '베이직 플랜을 이용 중'
    : !subscription.expiresAt
      ? '프리미엄 플랜을 이용 중'
      : subscription.willRenew
        ? `프리미엄 플랜을 이용 중 - 다음 결제일 : ${formatMonthDay(subscription.expiresAt)}`
        : `해지 예약됨 - ${formatMonthDay(subscription.expiresAt)}까지 이용 가능`;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">구독</Text>
        {!loading && (
          <Text className="text-[13px] text-secondary mt-1">{subtitle}</Text>
        )}
      </View>

      <View className="h-px bg-line" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : isPremium ? (
        <PremiumView
          subscription={{
            plan: subscription.plan,
            billing_cycle: subscription.billingCycle,
            is_active: subscription.isActive,
            started_at: subscription.startedAt,
            expires_at: subscription.expiresAt,
            will_renew: subscription.willRenew,
          }}
          onCancel={handleCancel}
        />
      ) : (
        <FreeView
          onSubscribe={handleSubscribe}
          onRestore={handleRestore}
          priceLabels={priceLabels}
          isPurchasing={isPurchasing}
        />
      )}
    </SafeAreaView>
  );
}
