import {create} from 'zustand';

import {startGpsTracking, stopGpsTracking} from '@/hooks/useGpsTracking';
import {
  readCellularUpload,
  readTracking,
  writeCellularUpload,
  writeTracking,
} from '@/utils/settingsStorage';

type SettingsStore = {
  /**
   * 위치 기록 사용 여부. 기본값은 켬 — 이 앱의 본질이 위치 기록이라
   * 처음 설치한 사용자가 아무 설정 없이도 기록이 남아야 한다.
   */
  isTrackingEnabled: boolean;
  /** 셀룰러에서도 사진을 올릴지. 기본값은 끔 — 요금이 사용자 돈이다 */
  isCellularUploadEnabled: boolean;
  /** 디스크에서 복원하기 전인지. 복원 전에 배너를 띄우면 잠깐 잘못 뜬다 */
  hasLoaded: boolean;

  initialize: () => Promise<void>;
  setTrackingEnabled: (enabled: boolean) => Promise<void>;
  setCellularUploadEnabled: (enabled: boolean) => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  isTrackingEnabled: true,
  isCellularUploadEnabled: false,
  hasLoaded: false,

  initialize: async () => {
    // 읽기 실패는 settingsStorage가 기본값으로 흡수한다 —
    // 사용자가 끈 적 없는데 꺼두면 기록이 조용히 사라진다
    const [tracking, cellular] = await Promise.all([
      readTracking(),
      readCellularUpload(),
    ]);

    set({
      isTrackingEnabled: tracking,
      isCellularUploadEnabled: cellular,
      hasLoaded: true,
    });
  },

  setTrackingEnabled: async enabled => {
    if (get().isTrackingEnabled === enabled) return;

    set({isTrackingEnabled: enabled});
    await writeTracking(enabled);

    // 백그라운드 태스크는 화면과 무관하게 살아 있으므로 즉시 손대야 한다.
    // 켤 때는 권한이 없으면 startGpsTracking이 조용히 return한다.
    if (enabled) {
      await startGpsTracking();
    } else {
      await stopGpsTracking();
    }
  },

  setCellularUploadEnabled: async enabled => {
    if (get().isCellularUploadEnabled === enabled) return;

    set({isCellularUploadEnabled: enabled});
    await writeCellularUpload(enabled);
  },
}));
