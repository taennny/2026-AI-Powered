/**
 * 직전에 프리미엄이었는지를 디스크에 남긴다.
 *
 * 구독 만료는 대부분 앱이 꺼져 있는 동안 지난다. 메모리 비교만으로는 잡을 수
 * 없다 — 앱을 켜면 subscriptionStore가 free에서 시작하므로 "프리미엄이었다"는
 * 사실 자체가 남아 있지 않다. 그래서 마지막으로 확인된 값을 여기에 둔다.
 *
 * 이 값은 **안내용이지 판정용이 아니다.** 프리미엄 개방은 언제나
 * `subscriptionStore.isPremium()`(=서버 응답)만 본다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const WAS_PREMIUM_KEY = 'subscription_was_premium';

export async function getWasPremium(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WAS_PREMIUM_KEY)) === 'true';
  } catch {
    // 읽기 실패는 "몰랐다"로 본다 — 만료 안내를 한 번 놓칠 뿐이다
    return false;
  }
}

export async function setWasPremium(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(WAS_PREMIUM_KEY, value ? 'true' : 'false');
  } catch {
    // 저장 실패해도 이번 세션 동작에는 지장이 없다
  }
}

/** 로그아웃·탈퇴 시 지운다 — 다음 계정이 이전 사용자의 상태를 물려받으면 안 된다 */
export async function clearWasPremium(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WAS_PREMIUM_KEY);
  } catch {
    // 무시
  }
}
