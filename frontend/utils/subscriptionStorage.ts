/**
 * 직전에 프리미엄이었는지 — 만료는 대개 앱이 꺼져 있을 때 지나므로 디스크에 남긴다.
 * **안내용이지 판정용이 아니다.** 개방은 언제나 `isPremium()`만 본다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const WAS_PREMIUM_KEY = 'subscription_was_premium';

export async function getWasPremium(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WAS_PREMIUM_KEY)) === 'true';
  } catch {
    return false; // 만료 안내를 한 번 놓칠 뿐이다
  }
}

export async function setWasPremium(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WAS_PREMIUM_KEY, value ? 'true' : 'false');
  } catch {
    // 이번 세션 동작에는 지장이 없다
  }
}

/** 로그아웃·탈퇴 시 — 다음 계정이 물려받으면 안 된다 */
export async function clearWasPremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WAS_PREMIUM_KEY);
  } catch {
    // 무시
  }
}
