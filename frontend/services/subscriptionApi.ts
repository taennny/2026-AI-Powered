/**
 * @file services/subscriptionApi.ts
 * @description 구독 상태 조회 API
 * GET /api/v1/subscriptions/me
 */

import {api} from '@/utils/api';

export type SubscriptionStatus = {
  plan: 'free' | 'premium';
  started_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

export async function fetchSubscription(): Promise<SubscriptionStatus> {
  const {data} = await api.get<SubscriptionStatus>('/api/v1/subscriptions/me');
  return data;
}
