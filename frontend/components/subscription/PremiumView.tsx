import {Linking, View, Text, TouchableOpacity} from 'react-native';

import {APP_STORE_SUBSCRIPTIONS_URL} from '@/constants/store';
import {ANNUAL_LABEL, MONTHLY_LABEL} from '@/constants/pricing';
import {
  type BillingCycle,
  type SubscriptionStatus,
} from '@/services/subscriptionApi';
import {useThemeColors} from '@/hooks/useThemeColors';
import SettingsActions from '@/components/settings/SettingsActions';

type Props = {subscription: SubscriptionStatus; onCancel: () => void};

const PLANS: {id: BillingCycle; label: string}[] = [
  {id: 'monthly', label: MONTHLY_LABEL},
  {id: 'annual', label: ANNUAL_LABEL},
];

function getDaysCount(startedAt: string): number {
  const diff = Date.now() - new Date(startedAt).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function PremiumView({subscription, onCancel}: Props) {
  const tc = useThemeColors();
  const currentBilling = subscription.billing_cycle;

  const daysCount = subscription.started_at
    ? getDaysCount(subscription.started_at)
    : 0;

  return (
    <View className="flex-1 px-6 pt-5">
      <Text className="text-base font-bold text-primary mb-5">
        프리미엄 플랜
      </Text>

      <View className="gap-y-[14px] mb-7">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentBilling;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={isCurrent ? 1 : 0.7}
              className="flex-row items-center gap-x-[10px]"
            >
              <View
                className="w-[18px] h-[18px] rounded-full items-center justify-center"
                style={{borderWidth: 1.5, borderColor: tc.tertiary}}
              >
                {isCurrent && (
                  <View className="w-[10px] h-[10px] rounded-full bg-tertiary" />
                )}
              </View>
              <Text
                className={`text-[15px] ${isCurrent ? 'text-secondary' : 'text-primary'}`}
              >
                {plan.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="bg-teal-bg rounded-2xl py-[22px] px-5 items-center mb-10">
        <Text className="text-[15px] text-primary mb-[6px]">
          로미와 함께 한 지 <Text className="font-bold">{daysCount}일</Text> 💗
        </Text>
        <Text className="text-sm text-secondary">우리 오래봐요!</Text>
      </View>

      <SettingsActions
        className="mt-auto pb-20"
        actions={[
          // 결제 수단도 우리가 못 바꾼다 — 앱스토어 구독 관리로 보낸다
          {
            label: '결제 수단 변경',
            onPress: () => {
              void Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL);
            },
          },
          // 이미 해지를 예약했으면 또 누를 이유가 없다 — 상단에 만료일이 떠 있다
          ...(subscription.will_renew
            ? [
                {
                  label: '구독 해지',
                  onPress: onCancel,
                  tone: 'muted' as const,
                },
              ]
            : []),
        ]}
      />
    </View>
  );
}
