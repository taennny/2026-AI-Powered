import {api} from '@/utils/api';

/** 결제 주기. 서버도 같은 문자열을 쓰고 만료일을 30일/365일로 계산한다 */
export type BillingCycle = 'monthly' | 'annual';

type SubscriptionResponse = {
  plan: 'free' | 'premium';
  billing_cycle?: BillingCycle;
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
  /** 해지 예약 시 false. 없으면 "다음 결제일"과 "해지 예약됨"을 구분 못 한다 */
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
    // 옛 서버 대응 (서버 기본값과 같다)
    billing_cycle: data.billing_cycle ?? 'monthly',
    is_active: data.is_active,
    started_at: data.started_at,
    expires_at: data.expires_at,
    // 옛 서버 대응
    will_renew: data.will_renew ?? true,
  };
}

/**
 * **화면에서 부르지 않는다.** 이 API로 plan을 바꾸면 Apple과 우리 DB가 어긋나
 * 결제 안 한 사용자가 프리미엄이 되거나 해지했는데 청구가 이어진다.
 * 개발 중 상태를 손으로 맞출 때만 쓴다.
 *
 * @deprecated 인앱결제(`services/purchases.ts`)로 대체됨
 */
export async function subscribePremium(
  billingCycle: BillingCycle = 'monthly',
): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {
    plan_type: 'premium',
    billing_cycle: billingCycle,
  });
}

/** @deprecated 해지는 앱스토어에서 한다 — `subscribePremium` 주석 참고 */
export async function cancelSubscription(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'free'});
}
