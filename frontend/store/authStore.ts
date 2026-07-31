/** 토큰의 디스크 저장은 tokenStorage, 이 store는 리렌더용 메모리 상태 — 둘 다 갱신해야 한다 */

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

  initialize: async () => {
    const token = await getAccessToken();
    set({accessToken: token, isAuthenticated: !!token});
  },

  logout: async () => {
    await removeTokens();
    set({accessToken: null, isAuthenticated: false});
  },
}));
