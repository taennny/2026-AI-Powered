import AsyncStorage from '@react-native-async-storage/async-storage';

import {useAuthStore} from '@/store/authStore';
import {isOnboardingDone, markOnboardingDone} from '@/utils/onboardingStorage';
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '@/utils/tokenStorage';

const reset = () => useAuthStore.setState({isAuthenticated: false});

describe('authStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    reset();
  });

  it('setAuthenticated는 인증 플래그를 세운다', () => {
    useAuthStore.getState().setAuthenticated();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('토큰 값을 store에 복제하지 않는다 — 단일 출처는 tokenStorage다', () => {
    useAuthStore.getState().setAuthenticated();

    expect(useAuthStore.getState()).not.toHaveProperty('accessToken');
  });

  it('clearAuth는 메모리 상태만 비운다 — 디스크는 건드리지 않는다', async () => {
    await saveTokens('access-1', 'refresh-1');
    useAuthStore.getState().setAuthenticated();

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await expect(getAccessToken()).resolves.toBe('access-1');
  });

  it('initialize는 디스크에 토큰이 있으면 인증 상태로 복원한다 — 앱 재시작 시 로그인 유지', async () => {
    await saveTokens('access-1', 'refresh-1');

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('저장된 토큰이 없으면 initialize 후 미인증이다', async () => {
    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('logout은 디스크와 메모리를 모두 비운다 — 둘 중 하나만 지우면 안 된다', async () => {
    await saveTokens('access-1', 'refresh-1');
    useAuthStore.getState().setAuthenticated();

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await expect(getAccessToken()).resolves.toBeNull();
    await expect(getRefreshToken()).resolves.toBeNull();
  });
});

describe('onboardingStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('처음에는 온보딩 미완료다', async () => {
    await expect(isOnboardingDone()).resolves.toBe(false);
  });

  it('완료 표시 후에는 다시 보여주지 않는다', async () => {
    await markOnboardingDone();

    await expect(isOnboardingDone()).resolves.toBe(true);
  });
});
