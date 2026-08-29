/**
 * 구독 상태 — 서버가 단일 출처다.
 *
 * 1. plan을 프론트가 직접 정하지 않는다 (검증 실패 시 유료 기능이 잠깐 열린다)
 * 2. 조회 실패 시 free로 떨어뜨린다 (모를 때 프리미엄이면 실패가 곧 개방이다)
 * 3. 프리미엄이 아닌데 프리미엄 테마면 basic으로 되돌린다
 */

import {create} from 'zustand';

import {DEFAULT_THEME, PREMIUM_THEMES} from '@/constants/themes';
import {fetchSubscription, type BillingCycle} from '@/services/subscriptionApi';
import {useThemeStore} from '@/store/themeStore';
import {
  clearWasPremium,
  getWasPremium,
  setWasPremium,
} from '@/utils/subscriptionStorage';

type SubscriptionStore = {
  // 서버가 주는 값 — readonly로 대입을 막는다. 갱신은 refresh()만.
  readonly plan: 'free' | 'premium';
  /** 월간/연간 — 표시용이다. 개방 판정에는 쓰지 않는다 */
  readonly billingCycle: BillingCycle;
  readonly isActive: boolean;
  readonly startedAt: string | null;
  readonly expiresAt: string | null;
  /** 해지 예약 시 false. **판정에 넣지 않는다** — 만료일까지는 프리미엄이다 */
  readonly willRenew: boolean;
  /** 한 번이라도 서버 응답을 받았는지 — 첫 로딩 표시에 쓴다 */
  readonly hasLoaded: boolean;
  readonly isLoading: boolean;
  /** **안내 전용.** 판정에 쓰지 않는다. 안내 후 acknowledgeExpiry()로 끈다 */
  readonly justExpired: boolean;
  /** 프리미엄 기능 개방 여부 — 이 값만 보고 판단할 것 */
  isPremium: () => boolean;
  refresh: () => Promise<void>;
  /** 만료 안내를 띄운 뒤 호출 — 복귀할 때마다 다시 뜨지 않게 한다 */
  acknowledgeExpiry: () => void;
  /** 결제 직후용 — 상태가 바뀔 때까지 몇 번 더 조회한다 */
  refreshUntilChanged: (wasPremium: boolean) => Promise<boolean>;
  reset: () => void;
};

/** 결제는 웹훅(SDK→Apple→RevenueCat→백엔드)을 거쳐 몇 초 늦게 반영된다 */
const RETRY_DELAYS_MS = [0, 1500, 3000, 5000];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FREE = {
  plan: 'free' as const,
  billingCycle: 'monthly' as const,
  isActive: false,
  startedAt: null,
  expiresAt: null,
  willRenew: true,
};

/** 만료 시각이 지났으면 서버에 묻지 않아도 프리미엄이 아니다 (앱을 오래 켜둔 경우) */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...FREE,
  hasLoaded: false,
  isLoading: false,
  justExpired: false,

  isPremium: () => {
    const {plan, isActive, expiresAt} = get();
    return plan === 'premium' && isActive && !isExpired(expiresAt);
  },

  refresh: async () => {
    set({isLoading: true});

    // 조회 실패(규칙 2의 free 강등)를 만료로 오인하면 안 된다
    let answered = false;

    try {
      const sub = await fetchSubscription();
      answered = true;
      set({
        plan: sub.plan,
        billingCycle: sub.billing_cycle,
        isActive: sub.is_active,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at,
        willRenew: sub.will_renew,
      });
    } catch {
      set(FREE); // 규칙 2
    } finally {
      set({hasLoaded: true, isLoading: false});
    }

    const premium = get().isPremium();

    // 규칙 3
    if (!premium) {
      const {themeId, setTheme} = useThemeStore.getState();
      if (PREMIUM_THEMES.includes(themeId)) {
        setTheme(DEFAULT_THEME);
      }
    }

    if (!answered) return;

    const wasPremium = await getWasPremium();
    if (wasPremium && !premium) set({justExpired: true});
    if (wasPremium !== premium) await setWasPremium(premium);
  },

  acknowledgeExpiry: () => set({justExpired: false}),

  /**
   * @param wasPremium 조작 직전 상태. 달라지면 반영된 것으로 본다
   * @returns false여도 실패는 아니다 — 웹훅이 더 늦을 수 있다
   */
  refreshUntilChanged: async wasPremium => {
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await sleep(delay);

      await get().refresh();
      if (get().isPremium() !== wasPremium) return true;
    }
    return false;
  },

  reset: () => {
    set({...FREE, hasLoaded: false, isLoading: false, justExpired: false});
    // 안 지우면 다음 계정에 "구독이 만료됐어요"가 뜬다
    void clearWasPremium();
  },
}));
