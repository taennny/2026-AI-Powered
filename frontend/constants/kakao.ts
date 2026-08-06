/**
 * 카카오 OAuth 설정 — 키와 도메인을 소스에 박지 않는다.
 * 리다이렉트 URI는 API 서버 주소에서 끌어오므로 로컬·운영이 자동으로 갈린다.
 */

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'
).replace(/\/+$/, '');
// 맨 끝 슬래시 제거 정규식. 카카오 개발자 콘솔에 등록된 값과 정확히 일치해야 한다.

/** 카카오 REST API 키 — 없으면 로그인 버튼이 동작하지 않는다 */
export const KAKAO_REST_API_KEY =
  process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';

/** 백엔드 콜백 — 카카오 개발자 콘솔에 등록된 값과 정확히 일치해야 한다 */
export const KAKAO_REDIRECT_URI = `${API_BASE_URL}/api/v1/auth/kakao/callback`;

/** 계정 연동 진입점 — 콜백이 source를 그대로 돌려주면 연동 후 설정 화면으로 복귀한다 */
export const KAKAO_LINK_URL = `${API_BASE_URL}/auth/kakao/link?source=account-link`;

/**
 * 앱으로 돌아오는 딥링크 스킴 — `openAuthSessionAsync`의 returnUrl로 쓴다.
 *
 * 백엔드 콜백(`KAKAO_REDIRECT_URI`)을 returnUrl로 주면 안 된다. returnUrl은
 * "이 URL에 도달하면 브라우저를 닫아라"는 뜻이라, 백엔드가 토큰을 만들어
 * 딥링크로 넘겨주기 전에 세션이 닫혀 code만 손에 쥐게 된다.
 * 백엔드는 `roameapp://kakao-login?accessToken=...`으로 리다이렉트한다
 * (backend/app/api/v1/auth.py).
 */
export const KAKAO_APP_REDIRECT = 'roameapp://kakao-login';

export function buildKakaoAuthUrl(): string {
  return (
    'https://kauth.kakao.com/oauth/authorize' +
    `?client_id=${KAKAO_REST_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    '&response_type=code'
  );
}
