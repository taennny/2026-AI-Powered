import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {useAuthStore} from '@/store/authStore';
import {isOnboardingDone, markOnboardingDone} from '@/utils/onboardingStorage';
import {
  getAccessToken,
  getRefreshToken,
  removeTokens,
  saveTokens,
} from '@/utils/tokenStorage';

const reset = () => useAuthStore.setState({isAuthenticated: false});

/** 토큰은 SecureStore에 있다 — AsyncStorage만 비우면 이전 테스트 값이 남는다 */
const clearStorages = async () => {
  await AsyncStorage.clear();
  (SecureStore as unknown as {__clear: () => void}).__clear();
};

describe('authStore', () => {
  beforeEach(async () => {
    await clearStorages();
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

describe('tokenStorage — 보안 저장소', () => {
  beforeEach(async () => {
    await clearStorages();
  });

  it('토큰을 평문(AsyncStorage)이 아니라 SecureStore에 쓴다', async () => {
    await saveTokens('access-1', 'refresh-1');

    await expect(SecureStore.getItemAsync('accessToken')).resolves.toBe(
      'access-1',
    );
    // 평문 저장소에는 흔적이 남으면 안 된다 — 백업으로 새는 경로다
    await expect(AsyncStorage.getItem('accessToken')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('refreshToken')).resolves.toBeNull();
  });

  it('예전 평문 저장소에 있던 토큰을 옮겨온다 — 업데이트 시 로그인이 풀리면 안 된다', async () => {
    // 구버전 앱이 남긴 상태
    await AsyncStorage.setItem('accessToken', 'legacy-access');
    await AsyncStorage.setItem('refreshToken', 'legacy-refresh');

    await expect(getAccessToken()).resolves.toBe('legacy-access');
    await expect(getRefreshToken()).resolves.toBe('legacy-refresh');

    // 옮긴 뒤 평문 사본은 지운다 — 남기면 옮긴 의미가 없다
    await expect(AsyncStorage.getItem('accessToken')).resolves.toBeNull();
    await expect(SecureStore.getItemAsync('accessToken')).resolves.toBe(
      'legacy-access',
    );
  });

  it('마이그레이션 전에 로그아웃해도 평문 사본이 남지 않는다', async () => {
    await AsyncStorage.setItem('accessToken', 'legacy-access');
    await AsyncStorage.setItem('refreshToken', 'legacy-refresh');

    await removeTokens();

    await expect(AsyncStorage.getItem('accessToken')).resolves.toBeNull();
    await expect(AsyncStorage.getItem('refreshToken')).resolves.toBeNull();
    await expect(getAccessToken()).resolves.toBeNull();
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
