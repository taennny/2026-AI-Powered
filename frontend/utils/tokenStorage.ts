/**
 * 토큰 값의 단일 출처(디스크).
 *
 * AsyncStorage가 아니라 SecureStore를 쓴다 — 평문이라 iOS 백업에 그대로 실린다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/** 웹에는 Keychain이 없다. 못 쓰면 앱이 죽는 대신 예전 저장소로 돌아간다 */
let secureStoreUsable: boolean | null = null;

async function canUseSecureStore(): Promise<boolean> {
  if (secureStoreUsable !== null) return secureStoreUsable;

  try {
    secureStoreUsable = await SecureStore.isAvailableAsync();
  } catch {
    secureStoreUsable = false;
  }

  return secureStoreUsable;
}

async function setItem(key: string, value: string): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

/** 없으면 업데이트 시 기존 로그인이 전부 풀린다. 옮긴 뒤 평문 사본까지 지운다 */
async function readWithMigration(key: string): Promise<string | null> {
  if (!(await canUseSecureStore())) {
    return AsyncStorage.getItem(key);
  }

  const secure = await SecureStore.getItemAsync(key);
  if (secure !== null) return secure;

  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null) return null;

  try {
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
  } catch {
    // 옮기지 못해도 값은 돌려준다 — null을 주면 멀쩡한 세션이 끊긴다
  }

  return legacy;
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken),
    setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function saveAccessToken(accessToken: string) {
  await setItem(ACCESS_TOKEN_KEY, accessToken);
}

export async function getAccessToken() {
  return await readWithMigration(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return await readWithMigration(REFRESH_TOKEN_KEY);
}

export async function removeTokens() {
  await Promise.all([
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
    // 마이그레이션 전에 로그아웃하면 평문 사본만 남는다
    AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]),
  ]);
}

/** 테스트 전용 — 모듈에 캐시된 가용성 판단을 초기화한다 */
export function __resetSecureStoreCache(): void {
  secureStoreUsable = null;
}
