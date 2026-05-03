/**
 * @file services/authApi.ts
 * @description 인증 관련 API
 */

import {api} from '@/utils/api';
import {saveTokens, saveAccessToken, getRefreshToken} from '@/utils/tokenStorage';

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

export async function signup({email, password}: SignupRequest) {
  const response = await api.post('/api/v1/auth/register', {email, password});
  return response.data;
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await api.post('/api/v1/auth/login', data);
  const {access_token, refresh_token} = response.data;
  await saveTokens(access_token, refresh_token);
  return response.data;
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('refresh token 없음');
  }
  const response = await api.post('/api/v1/auth/refresh', {refresh_token: refreshToken});
  await saveAccessToken(response.data.access_token);
  return response.data;
}

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
