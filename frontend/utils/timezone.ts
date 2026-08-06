/**
 * 기기 타임존 — 서버로 보내는 값.
 *
 * 오프셋 숫자가 아니라 IANA 문자열(`Asia/Seoul`)을 쓴다. 오프셋은 서머타임이 있는
 * 지역에서 계절마다 달라져, 과거 기록의 날짜 경계를 나중에 다시 계산할 수 없다.
 *
 * `Intl`은 Hermes 빌드에 따라 timeZone을 `UTC`로 뱉는 경우가 있어
 * expo-localization을 먼저 본다.
 */

import * as Localization from 'expo-localization';

const FALLBACK_TIME_ZONE = 'Asia/Seoul';

/** 'UTC'는 진짜 UTC 기기와 구분이 안 되지만, 한국 사용자 기준으로는 오류일 확률이 높다 */
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
