/**
 * 구독 상태 — 서버가 단일 출처다.
 *
 * 규칙 셋:
 * 1. plan을 프론트가 직접 정하지 않는다. 항상 서버 응답을 그대로 넣는다.
 *    (낙관적 업데이트를 하면 검증 실패 시 유료 기능이 잠깐 열린다.
 *     결제 진행 표시가 필요하면 plan이 아니라 isVerifying 같은 별도 플래그를 쓸 것)
 * 2. 조회에 실패하면 free로 떨어뜨린다. 모를 때 프리미엄으로 두면
 *    조회 실패가 곧 유료 기능 개방이 된다.
 * 3. 프리미엄이 아닌데 프리미엄 테마를 쓰고 있으면 basic으로 되돌린다.
 */

import {create} from 'zustand';

import {DEFAULT_THEME, PREMIUM_THEMES} from '@/constants/themes';
import {fetchSubscription} from '@/services/subscriptionApi';
import {useThemeStore} from '@/store/themeStore';

type SubscriptionStore = {
  // 서버가 주는 값 — readonly로 대입을 막는다. 갱신은 refresh()만.
  readonly plan: 'free' | 'premium';
  readonly isActive: boolean;
  readonly startedAt: string | null;
  readonly expiresAt: string | null;
  /**
   * 다음 결제일에 갱신되는지. 해지를 예약하면 false다.
   * **isPremium() 판정에는 넣지 않는다** — 해지를 예약해도 만료일까지는
   * 프리미엄이다. 이 값은 화면 문구에만 쓴다.
   */
  readonly willRenew: boolean;
  /** 한 번이라도 서버 응답을 받았는지 — 첫 로딩 표시에 쓴다 */
  readonly hasLoaded: boolean;
  readonly isLoading: boolean;
  /** 프리미엄 기능 개방 여부 — 이 값만 보고 판단할 것 */
  isPremium: () => boolean;
  refresh: () => Promise<void>;
  /** 결제 직후용 — 상태가 바뀔 때까지 몇 번 더 조회한다 */
  refreshUntilChanged: (wasPremium: boolean) => Promise<boolean>;
  reset: () => void;
};

/**
 * 결제 후 재조회 간격. 결제는 SDK→Apple→RevenueCat→우리 백엔드 웹훅을
 * 거치므로 몇 초 늦게 반영된다. 한 번만 조회하면 아직 free라 결제가 실패한
 * 것처럼 보인다.
 */
const RETRY_DELAYS_MS = [0, 1500, 3000, 5000];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const FREE = {
  plan: 'free' as const,
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

  isPremium: () => {
    const {plan, isActive, expiresAt} = get();
    return plan === 'premium' && isActive && !isExpired(expiresAt);
  },

  refresh: async () => {
    set({isLoading: true});

    try {
      const sub = await fetchSubscription();
      set({
        plan: sub.plan,
        isActive: sub.is_active,
        startedAt: sub.started_at,
        expiresAt: sub.expires_at,
        willRenew: sub.will_renew,
      });
    } catch {
      // 규칙 2 — 모르면 free
      set(FREE);
    } finally {
      set({hasLoaded: true, isLoading: false});
    }

    // 규칙 3 — 구독이 끊긴 채로 프리미엄 테마가 남아 있으면 되돌린다
    if (!get().isPremium()) {
      const {themeId, setTheme} = useThemeStore.getState();
      if (PREMIUM_THEMES.includes(themeId)) {
        setTheme(DEFAULT_THEME);
      }
    }
  },

  /**
   * 구독 상태가 바뀔 때까지 몇 번 더 조회한다.
   *
   * @param wasPremium 조작 직전의 상태. 이 값과 달라지면 반영된 것으로 본다
   * @returns 상태가 바뀌었으면 true. false여도 실패는 아니고, 웹훅이 더
   *          늦는 것일 수 있다 — 호출부가 "곧 반영됩니다"로 안내할 것
   */
  refreshUntilChanged: async wasPremium => {
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await sleep(delay);

      await get().refresh();
      if (get().isPremium() !== wasPremium) return true;
    }
    return false;
  },

  reset: () => set({...FREE, hasLoaded: false, isLoading: false}),
}));
