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
  // 갱신 시점은 useSubscriptionSync가 관리한다 — 여기서는 결제·해지 직후만 부른다
  const subscription = useSubscriptionStore();
  const loading = !subscription.hasLoaded;
  const isPremium = subscription.isPremium();

  const [options, setOptions] = useState<PurchaseOption[]>([]);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // 스토어 가격은 지역·환율에 따라 다르다. 못 받아오면 FreeView가
  // constants/pricing.ts의 국내 기준 값으로 그린다
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
      // 결제는 SDK가 Apple과 처리한다. 우리 서버에는 RevenueCat이 웹훅으로 알린다 —
      // 앱이 plan을 직접 바꾸면 검증 실패 시 유료 기능이 잠깐 열린다
      const result = await purchase(option.package);

      // 사용자가 시스템 다이얼로그를 닫은 것 — 오류가 아니다
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

  /** 기기 변경·재설치 때 구독을 되찾는 경로 — Apple 심사 필수 */
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

  /**
   * 해지는 우리 서버가 아니라 앱스토어에서 한다.
   * 구독의 실체가 Apple에 있어서, 우리 DB만 바꾸면 결제는 계속된다.
   */
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

  /**
   * 해지를 예약해도 만료일까지는 프리미엄이다. 그때도 "다음 결제일"이라고 하면
   * 해지가 안 된 줄 알고 또 해지하러 간다 — 갱신 여부를 문구로 구분한다.
   */
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
