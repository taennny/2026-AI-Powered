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
  // 백엔드 /me는 현재 email만 반환 — 카카오 연동 여부는 미구현(추후 확장)
  is_kakao_linked?: boolean;
}

export async function fetchMe(): Promise<UserMe> {
  const response = await api.get<UserMe>('/api/v1/auth/me');
  return response.data;
}

export async function deleteAccount(): Promise<void> {
  await api.delete('/api/v1/auth/me');
}
