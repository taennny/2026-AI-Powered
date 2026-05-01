import api from './api';
import {saveTokens, saveAccessToken, getRefreshToken} from './tokenStorage';

export interface SignupRequest {
  email: string;
  password: string;
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

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

// 회원가입
export async function signup({email, password}: SignupRequest) {
  const response = await api.post('/auth/signup', {
    email,
    password,
  });

  return response.data;
}

// 로그인
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post('/auth/login', data);

  const {access_token, refresh_token} = response.data;
  await saveTokens(access_token, refresh_token);

  return response.data;
}

// 토큰 재발급
export async function refreshAccessToken(): Promise<RefreshResponse> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    throw new Error('refresh token 없음');
  }

  const response = await api.post('/auth/refresh', {
    refresh_token: refreshToken,
  });

  await saveAccessToken(response.data.access_token);

  return response.data;
}

// 비밀번호 재설정 메일 발송
export async function sendResetEmail(email: string) {
  const response = await api.post('/auth/password/reset-email', {
    email,
  });

  return response.data;
}

// 비밀번호 재설정
export async function resetPassword(token: string, newPassword: string) {
  const response = await api.post('/auth/password/reset', {
    token,
    new_password: newPassword,
  });

  return response.data;
}