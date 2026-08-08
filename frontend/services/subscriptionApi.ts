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

/**
 * 인앱결제 도입 전에 쓰던 직접 변경 경로.
 *
 * **화면에서 부르지 않는다.** 구독의 실체는 앱스토어에 있고 상태는
 * RevenueCat 웹훅으로만 들어온다 — 앱이 이 API로 plan을 바꾸면 Apple과
 * 우리 DB가 어긋나서, 결제하지 않은 사용자가 프리미엄이 되거나
 * 해지했는데 청구가 계속되는 상태가 만들어진다.
 *
 * 결제는 `services/purchases.ts`, 해지는 앱스토어 구독 관리 화면
 * (`constants/store.ts`)으로 보낸다. 개발 중 상태를 손으로 맞춰야 할 때만
 * 쓰고, 지우지 않고 남겨둔 건 백엔드에 아직 엔드포인트가 살아 있어서다.
 *
 * @deprecated 인앱결제로 대체됨
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
