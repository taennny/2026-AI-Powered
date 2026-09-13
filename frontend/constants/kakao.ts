/** 카카오 OAuth 설정. 리다이렉트 URI는 API 서버 주소에서 끌어온다 */

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/+$/, ''); // 끝 슬래시 제거 — 콘솔 등록값과 한 글자도 달라선 안 된다

/** 카카오 REST API 키 — 없으면 로그인 버튼이 동작하지 않는다 */
export const KAKAO_REST_API_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

/** 백엔드 콜백 — 카카오 개발자 콘솔에 등록된 값과 정확히 일치해야 한다 */
export const KAKAO_REDIRECT_URI = `${API_BASE_URL}/api/v1/auth/kakao/callback`;

/**
 * `openAuthSessionAsync`의 returnUrl. 백엔드 콜백을 여기 주면 안 된다 —
 * returnUrl은 "도달하면 브라우저를 닫아라"라서 토큰을 받기 전에 세션이 닫힌다.
 */
export const KAKAO_APP_REDIRECT = 'roameapp://kakao-login';

/**
 * 로그인과 **다른 경로**여야 한다 — 연동은 토큰을 만들지 않는데,
 * 로그인 콜백은 토큰이 없으면 로그인 화면으로 보내 연동하고도 로그아웃된다.
 */
export const KAKAO_LINK_APP_REDIRECT = 'roameapp://kakao-link';

/**
 * 백엔드 콜백이 딥링크에 실어주는 `isNewUser`를 읽는다.
 * (`backend/app/api/v1/auth.py`의 `roameapp://kakao-login?...&isNewUser={is_new_user}`)
 *
 * **값이 파이썬 bool을 f-string에 넣은 `'True'`/`'False'`다.** 소문자 `'true'`와만
 * 비교하면 신규 가입자가 영영 안 잡힌다. 대소문자를 무시하고, 배열(같은 키가
 * 여러 번 오면 expo-linking이 배열로 준다)과 없는 경우도 받아낸다.
 *
 * 판단이 안 서면 **false**다 — 확신이 없을 때 동의 시트를 띄우면
 * 이미 동의한 기존 사용자가 로그인할 때마다 다시 보게 된다.
 */
export function parseIsNewUser(value: unknown): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

export function buildKakaoAuthUrl(): string {
  return (
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    '&response_type=code'
  );
}
