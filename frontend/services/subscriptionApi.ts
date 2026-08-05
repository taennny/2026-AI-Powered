import {api} from '@/utils/api';

type SubscriptionResponse = {
  plan: 'free' | 'premium';
  is_active: boolean;
  started_at: string | null;
  expires_at: string | null;
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
    plan: data.plan,
    is_active: data.is_active,
    started_at: data.started_at,
    expires_at: data.expires_at,
  };
}

export async function subscribePremium(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'premium'});
}

export async function cancelSubscription(): Promise<void> {
  await api.put('/api/v1/subscriptions/me', {plan_type: 'free'});
}
