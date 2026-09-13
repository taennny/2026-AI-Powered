/** 셀룰러에서도 사진을 올릴지. 기본은 꺼둠 — 사진 한 장이 3~5MB라 요금이 붙는다 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CELLULAR_UPLOAD_KEY = 'settings:cellularPhotoUpload';

export async function readCellularUpload(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CELLULAR_UPLOAD_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function writeCellularUpload(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CELLULAR_UPLOAD_KEY, String(enabled));
  } catch {
    // 저장에 실패해도 이번 세션에는 반영된다
  }
}
