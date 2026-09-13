import AsyncStorage from '@react-native-async-storage/async-storage';

import {useSettingsStore} from '@/store/settingsStore';
import {startGpsTracking, stopGpsTracking} from '@/hooks/useGpsTracking';

jest.mock('@/hooks/useGpsTracking', () => ({
  startGpsTracking: jest.fn(),
  stopGpsTracking: jest.fn(),
}));

const mockStart = startGpsTracking as jest.Mock;
const mockStop = stopGpsTracking as jest.Mock;

const KEY = 'settings:locationTracking';
const CELLULAR_KEY = 'settings:cellularPhotoUpload';

describe('settingsStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useSettingsStore.setState({
      isTrackingEnabled: true,
      isCellularUploadEnabled: false,
      hasLoaded: false,
    });
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset().mockResolvedValue(undefined);
  });

  describe('initialize', () => {
    // 이 앱의 본질이 위치 기록이라, 설정한 적 없는 사용자는 켜져 있어야 한다
    it('저장된 적이 없으면 켜진 상태로 시작한다', async () => {
      await useSettingsStore.getState().initialize();

      expect(useSettingsStore.getState().isTrackingEnabled).toBe(true);
      expect(useSettingsStore.getState().hasLoaded).toBe(true);
    });

    it('꺼둔 값을 복원한다', async () => {
      await AsyncStorage.setItem(KEY, 'false');

      await useSettingsStore.getState().initialize();

      expect(useSettingsStore.getState().isTrackingEnabled).toBe(false);
    });

    it('복원 전에는 hasLoaded가 false다 — 헤더 알림이 잘못 뜨는 것을 막는다', () => {
      expect(useSettingsStore.getState().hasLoaded).toBe(false);
    });
  });

  describe('setTrackingEnabled', () => {
    it('끄면 추적을 멈추고 저장한다', async () => {
      await useSettingsStore.getState().setTrackingEnabled(false);

      expect(mockStop).toHaveBeenCalled();
      expect(mockStart).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(KEY)).toBe('false');
    });

    it('켜면 추적을 시작하고 저장한다', async () => {
      await useSettingsStore.getState().setTrackingEnabled(false);
      mockStop.mockClear();

      await useSettingsStore.getState().setTrackingEnabled(true);

      expect(mockStart).toHaveBeenCalled();
      expect(await AsyncStorage.getItem(KEY)).toBe('true');
    });

    // 백그라운드 태스크는 화면과 무관하게 살아 있어 중복 호출이 낭비다
    it('같은 값이면 아무것도 하지 않는다', async () => {
      await useSettingsStore.getState().setTrackingEnabled(true);

      expect(mockStart).not.toHaveBeenCalled();
      expect(mockStop).not.toHaveBeenCalled();
    });

    // spyOn + mockRestore는 쓰지 않는다 — async-storage 목에는 복구할 원본이 없어
    // 그 뒤의 모든 쓰기가 조용히 사라진다(뒤 테스트가 통째로 거짓 통과한다)
    it('저장에 실패해도 이번 세션에는 반영된다', async () => {
      (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() =>
        Promise.reject(new Error('disk full')),
      );

      await useSettingsStore.getState().setTrackingEnabled(false);

      expect(useSettingsStore.getState().isTrackingEnabled).toBe(false);
      expect(mockStop).toHaveBeenCalled();
    });
  });

  // 사진 한 장이 3~5MB라, 사용자가 직접 켜기 전에는 요금이 나가면 안 된다
  describe('셀룰러 사진 업로드', () => {
    it('설정한 적이 없으면 꺼진 상태다', async () => {
      await useSettingsStore.getState().initialize();

      expect(useSettingsStore.getState().isCellularUploadEnabled).toBe(false);
    });

    it('켜면 디스크에 남고 다음 실행에 복원된다', async () => {
      await useSettingsStore.getState().setCellularUploadEnabled(true);
      expect(await AsyncStorage.getItem(CELLULAR_KEY)).toBe('true');

      useSettingsStore.setState({isCellularUploadEnabled: false});
      await useSettingsStore.getState().initialize();
      expect(useSettingsStore.getState().isCellularUploadEnabled).toBe(true);
    });

    // 위치 기록 토글과 서로 영향을 주면 안 된다
    it('위치 기록을 꺼도 셀룰러 설정은 그대로다', async () => {
      await useSettingsStore.getState().setCellularUploadEnabled(true);
      await useSettingsStore.getState().setTrackingEnabled(false);

      expect(useSettingsStore.getState().isCellularUploadEnabled).toBe(true);
    });
  });
});
