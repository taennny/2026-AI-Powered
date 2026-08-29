/**
 * 기기 타임존 — 서버로 보내는 값.
 *
 * 오프셋이 아니라 IANA 문자열을 쓴다 — 오프셋은 서머타임 지역에서 계절마다 달라져
 * 과거 기록의 경계를 다시 계산할 수 없다.
 * `Intl`이 Hermes 빌드에 따라 `UTC`를 뱉어서 expo-localization을 먼저 본다.
 */

import * as Localization from 'expo-localization';

const FALLBACK_TIME_ZONE = 'Asia/Seoul';

/** 진짜 UTC 기기와 구분은 안 되지만, 국내 기준으로는 오류일 확률이 높다 */
function isSuspicious(timeZone: string | null | undefined): boolean {
  return !timeZone || timeZone === 'UTC';
}

export function getDeviceTimeZone(): string {
  const fromLocalization = Localization.getCalendars()[0]?.timeZone;
  if (!isSuspicious(fromLocalization)) {
    return fromLocalization as string;
  }

  try {
    const fromIntl = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isSuspicious(fromIntl)) return fromIntl;
    // 둘 다 UTC라면 진짜 UTC 기기일 수 있으니 그대로 쓴다
    if (fromIntl) return fromIntl;
  } catch {
    // Intl 자체가 없는 환경
  }

  return FALLBACK_TIME_ZONE;
}
