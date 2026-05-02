/**
 * @file utils/api.ts
 * @description axios 인스턴스 — 모든 API 요청은 이 인스턴스를 사용
 *
 * ## 다음 연결 작업
 * - [ ] 인증 토큰 인터셉터 추가 (로그인 연결 시)
 */

import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 10000,
});
