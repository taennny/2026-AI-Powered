import {fetchSubscription} from '@/services/subscriptionApi';
import {useSubscriptionStore} from '@/store/subscriptionStore';
import {useThemeStore} from '@/store/themeStore';

jest.mock('@/services/subscriptionApi', () => ({
  fetchSubscription: jest.fn(),
}));

const mockFetch = fetchSubscription as jest.Mock;

const premium = (expiresAt: string | null = '2099-01-01T00:00:00Z') => ({
  plan: 'premium',
  is_active: true,
  started_at: '2026-01-01T00:00:00Z',
  expires_at: expiresAt,
  will_renew: true,
});

const free = {
  plan: 'free',
  is_active: false,
  started_at: null,
  expires_at: null,
  will_renew: true,
};

describe('subscriptionStore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useSubscriptionStore.getState().reset();
    useThemeStore.setState({themeId: 'basic'});
  });

  it('서버가 준 값을 그대로 반영한다', async () => {
    mockFetch.mockResolvedValue(premium());

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium()).toBe(true);
    expect(useSubscriptionStore.getState().hasLoaded).toBe(true);
  });

  it('조회에 실패하면 free로 떨어진다 — 모를 때 유료 기능을 열면 안 된다', async () => {
    mockFetch.mockRejectedValue(new Error('network'));

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().plan).toBe('free');
    expect(useSubscriptionStore.getState().isPremium()).toBe(false);
  });

  it('프리미엄이었다가 조회에 실패해도 free로 내려간다', async () => {
    mockFetch.mockResolvedValueOnce(premium());
    await useSubscriptionStore.getState().refresh();

    mockFetch.mockRejectedValueOnce(new Error('network'));
    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium()).toBe(false);
  });

  it('만료 시각이 지났으면 서버가 active라고 해도 프리미엄이 아니다', async () => {
    mockFetch.mockResolvedValue(premium('2020-01-01T00:00:00Z'));

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().plan).toBe('premium');
    expect(useSubscriptionStore.getState().isPremium()).toBe(false);
  });

  it('is_active가 false면 프리미엄이 아니다', async () => {
    mockFetch.mockResolvedValue({...premium(), is_active: false});

    await useSubscriptionStore.getState().refresh();

    expect(useSubscriptionStore.getState().isPremium()).toBe(false);
  });

  describe('프리미엄 테마 복귀', () => {
    it('구독이 끊기면 프리미엄 테마를 basic으로 되돌린다', async () => {
      useThemeStore.setState({themeId: 'strawberry'});
      mockFetch.mockResolvedValue(free);

      await useSubscriptionStore.getState().refresh();

      expect(useThemeStore.getState().themeId).toBe('basic');
    });

    it('조회 실패로 free가 된 경우에도 되돌린다', async () => {
      useThemeStore.setState({themeId: 'aqua'});
      mockFetch.mockRejectedValue(new Error('network'));

      await useSubscriptionStore.getState().refresh();

      expect(useThemeStore.getState().themeId).toBe('basic');
    });

    it('구독이 살아 있으면 프리미엄 테마를 건드리지 않는다', async () => {
      useThemeStore.setState({themeId: 'strawberry'});
      mockFetch.mockResolvedValue(premium());

      await useSubscriptionStore.getState().refresh();

      expect(useThemeStore.getState().themeId).toBe('strawberry');
    });

    it('무료 테마(dark)는 구독이 없어도 그대로 둔다', async () => {
      useThemeStore.setState({themeId: 'dark'});
      mockFetch.mockResolvedValue(free);

      await useSubscriptionStore.getState().refresh();

      expect(useThemeStore.getState().themeId).toBe('dark');
    });
  });

  describe('willRenew', () => {
    // 해지를 예약해도 만료일까지는 프리미엄이다. 판정에 넣으면 돈 낸 기간이 잘린다
    it('해지를 예약해도 만료 전이면 프리미엄이다', async () => {
      mockFetch.mockResolvedValue({...premium(), will_renew: false});

      await useSubscriptionStore.getState().refresh();

      expect(useSubscriptionStore.getState().isPremium()).toBe(true);
      expect(useSubscriptionStore.getState().willRenew).toBe(false);
    });

    it('reset하면 갱신 예정으로 돌아간다 — 다음 계정이 해지 상태를 물려받으면 안 된다', async () => {
      mockFetch.mockResolvedValue({...premium(), will_renew: false});
      await useSubscriptionStore.getState().refresh();

      useSubscriptionStore.getState().reset();

      expect(useSubscriptionStore.getState().willRenew).toBe(true);
    });
  });

  // 결제는 SDK→Apple→RevenueCat→백엔드 웹훅을 거쳐 몇 초 늦게 반영된다.
  // 한 번만 조회하면 아직 free라 결제가 실패한 것처럼 보인다
  describe('refreshUntilChanged', () => {
    // 재조회 사이에 실제로 몇 초씩 기다리므로 타이머를 가짜로 돌린다
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    /** 대기와 promise를 함께 흘린다 */
    const runAll = async (promise: Promise<boolean>) => {
      for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
        jest.runOnlyPendingTimers();
      }
      return promise;
    };

    it('상태가 바뀔 때까지 다시 조회한다', async () => {
      mockFetch
        .mockResolvedValueOnce(free)
        .mockResolvedValueOnce(free)
        .mockResolvedValueOnce(premium());

      const changed = await runAll(
        useSubscriptionStore.getState().refreshUntilChanged(false),
      );

      expect(changed).toBe(true);
      expect(useSubscriptionStore.getState().isPremium()).toBe(true);
    });

    it('첫 조회에 이미 바뀌었으면 더 부르지 않는다', async () => {
      mockFetch.mockResolvedValue(premium());

      await runAll(useSubscriptionStore.getState().refreshUntilChanged(false));

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // 실패가 아니라 웹훅이 더 늦는 것일 수 있다 — 호출부가 문구를 나눈다
    it('끝까지 안 바뀌면 false를 준다', async () => {
      mockFetch.mockResolvedValue(free);

      const changed = await runAll(
        useSubscriptionStore.getState().refreshUntilChanged(false),
      );

      expect(changed).toBe(false);
    });

    it('해지 방향도 감지한다', async () => {
      mockFetch.mockResolvedValueOnce(premium()).mockResolvedValueOnce(free);

      const changed = await runAll(
        useSubscriptionStore.getState().refreshUntilChanged(true),
      );

      expect(changed).toBe(true);
      expect(useSubscriptionStore.getState().isPremium()).toBe(false);
    });
  });

  it('reset은 다음 계정을 위해 상태를 비운다', async () => {
    mockFetch.mockResolvedValue(premium());
    await useSubscriptionStore.getState().refresh();

    useSubscriptionStore.getState().reset();

    expect(useSubscriptionStore.getState().isPremium()).toBe(false);
    expect(useSubscriptionStore.getState().hasLoaded).toBe(false);
  });
});
