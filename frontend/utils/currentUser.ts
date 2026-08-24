/**
 * 지금 로그인한 사용자의 id. GPS 큐가 좌표의 주인을 표시하는 데 쓴다 —
 * 좌표는 수집 시점과 업로드 시점이 몇 분씩 벌어져, 그 사이 계정을 바꾸면
 * 이전 계정의 좌표가 새 계정에 저장된다.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {fetchMe} from '@/services/authApi';

const CURRENT_USER_ID_KEY = 'auth:currentUserId';

export async function getCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_USER_ID_KEY);
  } catch {
    return null;
  }
}

/** 로그인 직후 호출. 실패하면 다음 진입·복귀에서 다시 시도된다 */
export async function syncCurrentUserId(): Promise<void> {
  try {
    const me = await fetchMe();
    if (!me.user_id) return;
    await AsyncStorage.setItem(CURRENT_USER_ID_KEY, me.user_id);
  } catch {
    // 무시
  }
}

export async function clearCurrentUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CURRENT_USER_ID_KEY);
  } catch {
    // 무시
  }
}
