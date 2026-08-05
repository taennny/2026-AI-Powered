/**
 * 인증 여부만 들고 있는 메모리 상태 — 화면 가드 리렌더용.
 * 토큰 값의 단일 출처는 tokenStorage(디스크)이고, 요청 시 utils/api.ts의
 * 인터셉터가 거기서 직접 꺼내 쓴다. 여기에 토큰을 복제해두면 401 재발급 때마다
 * 두 곳이 어긋나므로 두지 않는다.
 */

import {create} from 'zustand';

import {getAccessToken, removeTokens} from '@/utils/tokenStorage';

type AuthStore = {
  isAuthenticated: boolean;
  /** 토큰을 디스크에 저장한 뒤 호출한다 */
  setAuthenticated: () => void;
  /** 메모리 상태만 내린다 — 디스크까지 비우려면 logout() */
  clearAuth: () => void;
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>(set => ({
  isAuthenticated: false,

  setAuthenticated: () => set({isAuthenticated: true}),

  clearAuth: () => set({isAuthenticated: false}),

  initialize: async () => {
    const token = await getAccessToken();
    set({isAuthenticated: !!token});
  },

  logout: async () => {
    await removeTokens();
    set({isAuthenticated: false});
  },
}));
