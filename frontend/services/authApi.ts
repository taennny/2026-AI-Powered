import {api} from '@/utils/api';
import {saveTokens} from '@/utils/tokenStorage';

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export async function signup({email, password, nickname}: SignupRequest) {
  const response = await api.post('/api/v1/auth/register', {
    email,
    password,
    nickname,
  });
  return response.data;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post('/api/v1/auth/login', data);
  const {access_token, refresh_token} = response.data;
  await saveTokens(access_token, refresh_token);
  return response.data;
}

// 토큰 재발급은 utils/api.ts의 응답 인터셉터가 401을 받아 알아서 처리한다.
// 여기에 같은 로직을 또 두면 재발급 경로가 둘로 갈라진다.

export async function sendResetEmail(email: string) {
  const response = await api.post('/api/v1/auth/password-reset/request', {email});
  return response.data;
}

export async function resetPassword(token: string, newPassword: string) {
  const response = await api.post('/api/v1/auth/password-reset/confirm', {
    token,
    new_password: newPassword,
  });
  return response.data;
}

export interface UserMe {
  email: string;
  /**
   * 우리 서비스의 사용자 id. 결제 SDK(RevenueCat)에 이 값을 넘겨야
   * 결제 웹훅이 어느 계정 것인지 매칭된다.
   */
  user_id?: string;
  /** 백엔드가 `social_id != null`로 판정해 내려준다 */
  is_kakao_linked?: boolean;
}

export async function fetchMe(): Promise<UserMe> {
  const response = await api.get<UserMe>('/api/v1/auth/me');
  return response.data;
}

export async function deleteAccount(): Promise<void> {
  await api.delete('/api/v1/auth/me');
}

/**
 * 카카오 연동 시작 URL을 받아온다.
 *
 * **브라우저로 직접 열면 안 되는 엔드포인트다.** 서버가 `Authorization` 헤더로
 * 누구의 연동인지 판단해 state 토큰(5분 만료)에 user_id를 심는데, 시스템
 * 브라우저는 앱이 들고 있는 토큰을 모르므로 401이 난다. 여기서 axios로 받아
 * (인터셉터가 토큰을 붙인다) 돌려받은 URL만 브라우저에 넘긴다.
 */
export async function fetchKakaoLinkUrl(): Promise<string> {
  const response = await api.get<{authorize_url: string}>(
    '/api/v1/auth/kakao/link',
  );
  return response.data.authorize_url;
}
