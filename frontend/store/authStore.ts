/**
 * @file store/authStore.ts
 * @description 인증 상태 관리 store
 *
 * tokenStorage = 디스크 저장 (앱 재시작 후에도 유지)
 * authStore   = 메모리 상태 (컴포넌트가 로그인/로그아웃 변화를 즉시 감지)
 *
 * 사용 패턴:
 *   로그인  → saveTokens() + authStore.setToken()
 *   로그아웃 → removeTokens() + authStore.clearToken()
 *   앱 시작 → authStore.initialize() (tokenStorage → store 동기화)
 */

import {create} from 'zustand';
import {getAccessToken, removeTokens} from '@/utils/tokenStorage';

type AuthStore = {
  accessToken: string | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken: null,
  isAuthenticated: false,

  setToken: (token) =>
    set({accessToken: token, isAuthenticated: true}),

  clearToken: () =>
    set({accessToken: null, isAuthenticated: false}),

  // 앱 시작 시 tokenStorage에서 읽어와 store 동기화
  initialize: async () => {
    const token = await getAccessToken();
    set({accessToken: token, isAuthenticated: !!token});
  },

  // 로그아웃: tokenStorage 삭제 + store 초기화
  logout: async () => {
    await removeTokens();
    set({accessToken: null, isAuthenticated: false});
  },
}));
