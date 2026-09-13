/**
 * 설정 값의 디스크 저장. `settingsStore`와, 스토어를 끌어올 수 없는 `photoSync`가 함께 쓴다.
 *
 * `photoSync`가 스토어 대신 여기를 읽는 이유는 순수 유틸이기 때문이다 —
 * `settingsStore`를 import하면 `useGpsTracking`을 거쳐 `expo-location`까지 딸려와,
 * 백그라운드에서 도는 코드가 네이티브 모듈에 묶인다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACKING_KEY = 'settings:locationTracking';
const CELLULAR_UPLOAD_KEY = 'settings:cellularPhotoUpload';

async function read(key: string, fallback: boolean): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    // 저장된 적이 없으면(null) 기본값
    return raw === null ? fallback : raw === 'true';
  } catch {
    return fallback;
  }
}

async function write(key: string, value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(value));
  } catch {
    // 저장에 실패해도 이번 세션에는 반영된다
  }
}

/** 위치 기록. 기본 켬 — 이 앱의 본질이라 설정한 적 없는 사용자도 기록이 남아야 한다 */
export const readTracking = () => read(TRACKING_KEY, true);
export const writeTracking = (enabled: boolean) => write(TRACKING_KEY, enabled);

/** 셀룰러 사진 업로드. 기본 끔 — 사진 한 장이 3~5MB라 요금이 사용자 돈이다 */
export const readCellularUpload = () => read(CELLULAR_UPLOAD_KEY, false);
export const writeCellularUpload = (enabled: boolean) =>
  write(CELLULAR_UPLOAD_KEY, enabled);
