import {api} from '@/utils/api';

type SubscriptionResponse = {
  plan: 'free' | 'premium';
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
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  will_renew: boolean;
};

export async function fetchSubscription(): Promise<SubscriptionStatus> {
  const {data} = await api.get<SubscriptionResponse>('/api/v1/subscriptions/me');
  return {
    plan: data.plan,
    is_active: data.is_active,
    started_at: data.started_at,
    expires_at: data.expires_at,
    // 옛 서버는 안 내려준다 — 그때는 갱신되는 것으로 본다
    will_renew: data.will_renew ?? true,
  };
}

export async function subscribePremium(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'premium'});
}

export async function cancelSubscription(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'free'});
}
