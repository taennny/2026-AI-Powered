import {api} from '@/utils/api';

/** 결제 주기. 서버도 같은 문자열을 쓰고 만료일을 30일/365일로 계산한다 */
export type BillingCycle = 'monthly' | 'annual';

type SubscriptionResponse = {
  plan: 'free' | 'premium';
  billing_cycle?: BillingCycle;
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  /**
   * 다음 결제일에 갱신될지. 해지를 예약하면 false가 되고, 그래도 만료일까지는
   * 프리미엄이다. 이 값이 없으면 "다음 결제일"과 "해지 예약됨"을 구분할 수
   * 없어 사용자가 해지가 안 된 줄 알고 또 해지하러 간다.
   */
  will_renew?: boolean;
};

export type SubscriptionStatus = {
  plan: 'free' | 'premium';
  billing_cycle: BillingCycle;
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  will_renew: boolean;
};

export async function fetchSubscription(): Promise<SubscriptionStatus> {
  const {data} = await api.get<SubscriptionResponse>(
    '/api/v1/subscriptions/me',
  );
  return {
    plan: data.plan,
    // 옛 서버는 안 내려준다 — 그때는 월간으로 본다 (서버 기본값과 같다)
    billing_cycle: data.billing_cycle ?? 'monthly',
    is_active: data.is_active,
    started_at: data.started_at,
    expires_at: data.expires_at,
    // 옛 서버는 안 내려준다 — 그때는 갱신되는 것으로 본다
    will_renew: data.will_renew ?? true,
  };
}

export async function subscribePremium(
  billingCycle: BillingCycle = 'monthly',
): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {
    plan_type: 'premium',
    billing_cycle: billingCycle,
  });
}

export async function cancelSubscription(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'free'});
}
