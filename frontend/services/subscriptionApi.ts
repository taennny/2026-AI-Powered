/**
 * @file services/subscriptionApi.ts
 * @description 구독 상태 조회 API
 * GET /api/v1/subscriptions/me
 */

import {api} from '@/utils/api';

type SubscriptionResponse = {
  plan_type: 'free' | 'premium';
  is_active: boolean;
  expires_at: string | null;
  created_at?: string;
  updated_at?: string;
  id?: string;
  user_id?: string;
};

export type SubscriptionStatus = {
  plan: 'free' | 'premium';
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
};

export async function fetchSubscription(): Promise<SubscriptionStatus> {
  const {data} = await api.get<SubscriptionResponse>('/api/v1/subscriptions/me');
  return {
    plan: data.plan_type,
    is_active: data.is_active,
    started_at: data.updated_at ?? null,
    expires_at: data.expires_at,
  };
}

export async function subscribePremium(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'premium'});
}

export async function cancelSubscription(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'free'});
}
