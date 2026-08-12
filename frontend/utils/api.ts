import axios from 'axios';

import {
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  removeTokens,
} from '@/utils/tokenStorage';
import {useAuthStore} from '@/store/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

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
 * 재발급을 기다리던 요청들을 정리한다.
 *
 * **큐에 들어온 요청은 반드시 둘 중 하나로 끝나야 한다.** 여기 항목들은
 * `new Promise`로 호출부에 매달려 있어서, resolve도 reject도 안 하고 지나가면
 * 그 요청은 영원히 끝나지 않는다 — 화면은 무한 로딩이 되고, axios 타임아웃은
 * 이미 응답(401)을 받은 뒤라 걸리지 않는다.
 *
 * 그래서 "토큰이 있으면 재시도, 없으면 실패"로만 가른다. 예전에는
 * `if (error) ... else if (token) ...`이라 둘 다 없으면 조용히 빠져나갔다.
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
          // 재발급을 시도조차 못 하므로 기다리던 요청도 여기서 끊는다.
          // 빠뜨리면 그 요청들이 매달릴 뿐 아니라 failedQueue에 그대로 남아,
          // 다음 로그인 때 재발급이 성공하는 순간 이전 세션의 요청이
          // 새 사용자의 토큰으로 재전송된다.
          //
          // isRefreshing으로 문을 잠갔으면 어느 출구로 나가든 반드시
          // processQueue를 거쳐야 한다 — 여기가 그 출구 중 하나다.
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
