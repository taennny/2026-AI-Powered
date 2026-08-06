import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

import {startGpsTracking, stopGpsTracking} from '@/hooks/useGpsTracking';

const TRACKING_KEY = 'settings:locationTracking';

type SettingsStore = {
  /**
   * 위치 기록 사용 여부. 기본값은 켬 — 이 앱의 본질이 위치 기록이라
   * 처음 설치한 사용자가 아무 설정 없이도 기록이 남아야 한다.
   */
  isTrackingEnabled: boolean;
  /** 디스크에서 복원하기 전인지. 복원 전에 배너를 띄우면 잠깐 잘못 뜬다 */
  hasLoaded: boolean;

  initialize: () => Promise<void>;
  setTrackingEnabled: (enabled: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  isTrackingEnabled: true,
  hasLoaded: false,

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(TRACKING_KEY);
      // 저장된 적이 없으면(null) 기본값 유지
      set({isTrackingEnabled: raw === null ? true : raw === 'true'});
    } catch {
      // 읽지 못하면 켠 것으로 본다 — 사용자가 끈 적 없는데 꺼두면
      // 기록이 조용히 사라진다
    } finally {
      set({hasLoaded: true});
    }
  },

  setTrackingEnabled: async enabled => {
    if (get().isTrackingEnabled === enabled) return;

    set({isTrackingEnabled: enabled});

    try {
      await AsyncStorage.setItem(TRACKING_KEY, String(enabled));
    } catch {
      // 저장에 실패해도 이번 세션에는 반영된다
    }

    // 백그라운드 태스크는 화면과 무관하게 살아 있으므로 즉시 손대야 한다.
    // 켤 때는 권한이 없으면 startGpsTracking이 조용히 return한다.
    if (enabled) {
      await startGpsTracking();
    } else {
      await stopGpsTracking();
    }
  },
}));
