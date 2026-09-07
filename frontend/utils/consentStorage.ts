/**
 * 카카오 가입 동의를 받았는지. **로그아웃해도 지우지 않는다** —
 * 같은 사람이 다시 로그인할 때마다 동의를 또 받으면 성가시다.
 *
 * 기기 단위라 재설치하면 다시 묻는다. 베타에는 그 정도로 충분하다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KAKAO_CONSENT_KEY = 'consent:kakao';

export async function hasAgreedToKakaoConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KAKAO_CONSENT_KEY)) !== null;
  } catch {
    // 못 읽으면 한 번 더 묻는다 — 안 받은 채로 넘기는 것보다 낫다
    return false;
  }
}

export async function markKakaoConsentAgreed(): Promise<void> {
  try {
    await AsyncStorage.setItem(KAKAO_CONSENT_KEY, 'true');
  } catch {
    // 다음 로그인 때 한 번 더 물어볼 뿐이다
  }
}
