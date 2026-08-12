/**
 * 토큰 값의 단일 출처(디스크).
 *
 * **AsyncStorage가 아니라 SecureStore를 쓴다.** AsyncStorage는 암호화되지 않은
 * 평문 파일이라 iOS에서는 iCloud·iTunes 백업에 그대로 들어가고, 백업을 추출하거나
 * 탈옥한 기기에서는 읽힌다. 액세스·리프레시 토큰이 새면 계정이 그대로 넘어간다 —
 * 특히 리프레시 토큰은 수명이 길어 피해가 오래간다.
 * SecureStore는 iOS Keychain / Android Keystore에 넣으므로 백업에 평문으로
 * 실리지 않는다.
 *
 * 토큰을 `authStore`에 복제하지 않는 이유는 CLAUDE.md 참고 — 인터셉터가 항상
 * 여기서 직접 꺼내야 401 재발급 때 두 곳이 어긋나지 않는다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * SecureStore는 네이티브 저장소(Keychain/Keystore)라 웹에는 없다.
 * 못 쓰는 환경에서 앱 전체가 죽는 것보다는 예전 저장소로 돌아가는 편이 낫다 —
 * 실기기에서는 항상 SecureStore가 쓰인다.
 */
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

/**
 * 예전 AsyncStorage에 남아 있던 토큰을 SecureStore로 옮긴다.
 *
 * **이게 없으면 업데이트 시 기존 로그인이 전부 풀린다.** 새 저장소는 비어 있으니
 * 앱이 미인증으로 판단해 로그인 화면부터 시작하게 된다.
 * 옮긴 뒤 평문 사본을 지우는 것까지가 이 함수의 일이다 — 남겨두면 애초에
 * 옮긴 의미가 없다.
 */
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
    // 옮기지 못해도 값 자체는 돌려준다 — 여기서 null을 주면 멀쩡한 세션이 끊긴다.
    // 다음 호출에서 다시 시도된다.
  }

  return legacy;
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  // SecureStore에는 multiSet이 없다 — 키마다 따로 쓴다
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
    // 마이그레이션 전에 로그아웃하는 경우가 있다. 평문 사본이 남으면
    // 로그아웃했는데 디스크에는 토큰이 그대로 있는 상태가 된다
    AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]),
  ]);
}

/** 테스트 전용 — 모듈에 캐시된 가용성 판단을 초기화한다 */
export function __resetSecureStoreCache(): void {
  secureStoreUsable = null;
}
