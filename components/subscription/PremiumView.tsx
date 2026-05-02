/**
 * @file components/subscription/PremiumView.tsx
 * @description 구독 화면 — 프리미엄 사용자 뷰
 *
 * ## 다음 연결 작업
 * - [ ] 결제 수단 변경 → 결제 플로우 연결
 * - [ ] 구독 해지 → 해지 확인 모달 연결
 * - [ ] API에서 월/연 플랜 구분 필드 추가 시 currentBilling 동적 처리
 */

import {View, Text, TouchableOpacity} from 'react-native';

import {type SubscriptionStatus} from '@/services/subscriptionApi';
import {Colors} from '@/constants/Colors';

type Props = {
  subscription: SubscriptionStatus;
};

type BillingCycle = 'monthly' | 'annual';

const PLANS: {id: BillingCycle; label: string}[] = [
  {id: 'monthly', label: '월 ₩7,500'},
  {id: 'annual', label: '연 ₩39,000 (33% 할인! 💡)'},
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

  const nextPayment = subscription.started_at
    ? getNextPaymentDate(subscription.started_at)
    : '-';
  const daysCount = subscription.started_at
    ? getDaysCount(subscription.started_at)
    : 0;

  return (
    <View style={{flex: 1, paddingHorizontal: 24}}>
      {/* 서브 타이틀 */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: Colors.textPrimary,
          marginBottom: 20,
        }}
      >
        프리미엄 플랜
      </Text>

      {/* 플랜 선택 */}
      <View style={{gap: 14, marginBottom: 28}}>
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentBilling;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={isCurrent ? 1 : 0.7}
              style={{flexDirection: 'row', alignItems: 'center', gap: 10}}
            >
              {/* 라디오 버튼 — 현재 플랜은 회색 채움 */}
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1.5,
                  borderColor: isCurrent
                    ? Colors.textTertiary
                    : Colors.textTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCurrent && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: Colors.textTertiary,
                    }}
                  />
                )}
              </View>
              <Text
                style={{
                  fontSize: 15,
                  color: isCurrent ? Colors.textSecondary : Colors.textPrimary,
                }}
              >
                {plan.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* D-day 박스 */}
      <View
        style={{
          backgroundColor: Colors.tealBg,
          borderRadius: 16,
          paddingVertical: 22,
          paddingHorizontal: 20,
          alignItems: 'center',
          marginBottom: 40,
        }}
      >
        <Text
          style={{fontSize: 15, color: Colors.textPrimary, marginBottom: 6}}
        >
          로미와 함께 한 지{' '}
          <Text style={{fontWeight: '700'}}>{daysCount}일</Text> 💗
        </Text>
        <Text style={{fontSize: 14, color: Colors.textSecondary}}>
          우리 오래봐요!
        </Text>
      </View>

      {/* 하단 버튼 */}
      <View style={{gap: 16, marginTop: 'auto', paddingBottom: 40}}>
        <TouchableOpacity>
          <Text style={{fontSize: 15, color: Colors.textPrimary}}>
            결제 수단 변경
          </Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={{fontSize: 14, color: Colors.textTertiary}}>
            구독 해지
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
