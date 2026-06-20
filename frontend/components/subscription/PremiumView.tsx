/**
 * @file components/subscription/PremiumView.tsx — 구독 화면 프리미엄 사용자 뷰
 *
 * ## 다음 연결 작업
 * - [ ] 결제 수단 변경 → 결제 플로우 연결
 * - [ ] 구독 해지 → 해지 확인 모달 연결
 * - [ ] API에서 월/연 플랜 구분 필드 추가 시 currentBilling 동적 처리
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type SubscriptionStatus} from '@/services/subscriptionApi';

type Props = {subscription: SubscriptionStatus};
type BillingCycle = 'monthly' | 'annual';

const PLANS: {id: BillingCycle; label: string}[] = [
  {id: 'monthly', label: '월 ₩7,500'},
  {id: 'annual',  label: '연 ₩39,000 (33% 할인! 💡)'},
];

function getNextPaymentDate(startedAt: string): string {
  const next = new Date(startedAt);
  next.setDate(next.getDate() + 30);
  return `${next.getMonth() + 1}월 ${next.getDate()}일`;
}

function getDaysCount(startedAt: string): number {
  const diff = Date.now() - new Date(startedAt).getTime();
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function PremiumView({subscription}: Props) {
  // TODO: API에서 월/연 구분 필드 추가 시 동적으로 변경
  const currentBilling: BillingCycle = 'monthly';

  const nextPayment = subscription.started_at ? getNextPaymentDate(subscription.started_at) : '-';
  const daysCount   = subscription.started_at ? getDaysCount(subscription.started_at) : 0;

  return (
    <View className="flex-1 px-6">
      <Text className="text-base font-bold text-primary mb-5">프리미엄 플랜</Text>

      {/* 플랜 선택 (현재 플랜 표시) */}
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
                style={{borderWidth: 1.5, borderColor: '#9ca3af'}}
              >
                {isCurrent && <View className="w-[10px] h-[10px] rounded-full bg-tertiary" />}
              </View>
              <Text className={`text-[15px] ${isCurrent ? 'text-secondary' : 'text-primary'}`}>
                {plan.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* D-day 박스 */}
      <View className="bg-teal-bg rounded-2xl py-[22px] px-5 items-center mb-10">
        <Text className="text-[15px] text-primary mb-[6px]">
          로미와 함께 한 지 <Text className="font-bold">{daysCount}일</Text> 💗
        </Text>
        <Text className="text-sm text-secondary">우리 오래봐요!</Text>
      </View>

      {/* 하단 버튼 */}
      <View className="gap-y-4 mt-auto pb-10">
        <TouchableOpacity>
          <Text className="text-[15px] text-primary">결제 수단 변경</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text className="text-sm text-tertiary">구독 해지</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
