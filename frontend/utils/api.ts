import axios from 'axios';

import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  removeTokens,
} from '@/utils/tokenStorage';
import {useAuthStore} from '@/store/authStore';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

const DEFAULT_TIMEOUT_MS = 15000;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async config => {
    const accessToken = await getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

/**
 * 큐의 요청은 반드시 resolve나 reject 중 하나로 끝나야 한다 — 그냥 지나가면
 * 호출부에 매달린 채 영원히 안 끝난다(axios 타임아웃은 이미 응답을 받아 안 걸린다).
 */
function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({resolve, reject}) => {
    if (token) {
      resolve(token);
    } else {
      reject(error ?? new Error('TOKEN_REFRESH_FAILED'));
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();

        if (!refreshToken) {
          // 큐를 안 끊으면 매달릴 뿐 아니라, 다음 로그인 때 이전 세션 요청이
          // 새 사용자 토큰으로 재전송된다
          processQueue(error, null);
          await removeTokens();
          useAuthStore.getState().clearAuth();
          return Promise.reject(error);
        }

        const refreshResponse = await axios.post(
          `${BASE_URL}/api/v1/auth/refresh`,
          {refresh_token: refreshToken},
          {headers: {'Content-Type': 'application/json'}},
        );

        const newAccessToken = refreshResponse.data.access_token;
        await saveAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await removeTokens();
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
