import {useEffect} from 'react';
import {Alert, AppState, Linking} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import {PERMISSION_MESSAGES} from '@/constants/permissionMessages';
import {startGpsTracking} from '@/hooks/useGpsTracking';
import {useSettingsStore} from '@/store/settingsStore';

type PermissionMessage = {title: string; message: string};

// 권한 확인이 진입·복귀마다 돌아서, 없으면 같은 Alert이 여러 장 쌓인다
let isAlertOpen = false;
let isCheckingLocation = false;

function alertWithSettings({title, message}: PermissionMessage) {
  if (isAlertOpen) return;
  isAlertOpen = true;

  Alert.alert(title, message, [
    {text: '나중에', style: 'cancel', onPress: () => (isAlertOpen = false)},
    {
      text: '설정 열기',
      onPress: () => {
        isAlertOpen = false;
        Linking.openSettings();
      },
    },
  ]);
}

/** 아직 물어볼 수 있으면 시스템 다이얼로그, 이미 거부됐으면 설정 안내 */
async function ensureLocationPermissions(): Promise<boolean> {
  if (isCheckingLocation) return false;
  isCheckingLocation = true;

  try {
    let fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted' && fg.canAskAgain) {
      fg = await Location.requestForegroundPermissionsAsync();
    }
    if (fg.status !== 'granted') {
      alertWithSettings(PERMISSION_MESSAGES.locationForeground);
      return false;
    }

    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && bg.canAskAgain) {
      bg = await Location.requestBackgroundPermissionsAsync();
    }
    if (bg.status !== 'granted') {
      alertWithSettings(PERMISSION_MESSAGES.locationBackground);
      return false;
    }

    return true;
  } finally {
    isCheckingLocation = false;
  }
}

/**
 * 현재 호출부가 없다 — '사진 모아보기'용으로 남겨둔 것이므로 지우지 말 것.
 */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }

  if (!permission.granted) {
    alertWithSettings(PERMISSION_MESSAGES.mediaLibrary);
    return false;
  }
  return true;
}

/**
 * 타임라인 카드 사진용 — 사용자 조작 없이 쓰인다.
 * 거부해도 나머지는 동작하므로 설정 안내를 띄우지 않는다.
 */
async function ensurePhotoLibraryPermission(): Promise<boolean> {
  let permission = await MediaLibrary.getPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await MediaLibrary.requestPermissionsAsync();
  }
  return permission.status === 'granted';
}

/** 설정에서 뒤늦게 허용한 경우도 여기서 살아난다 */
async function checkLocationAndStartTracking() {
  const granted = await ensureLocationPermissions();

  if (granted) {
    // 복원 전이면 기본값(켬)이라 잠깐 켜졌다 꺼진다 — 복원을 기다린다
    const settings = useSettingsStore.getState();
    if (!settings.hasLoaded) await settings.initialize();
    if (useSettingsStore.getState().isTrackingEnabled) {
      await startGpsTracking();
    }
  }

  // 위치 결과와 무관하게 묻되 순서는 뒤 — 다이얼로그가 겹치면 뒤엣것이 무시된다
  await ensurePhotoLibraryPermission();
}

/**
 * (main)에 한 번만 마운트한다 — 온보딩이 (main) 바깥이라
 * 신규 사용자에게는 온보딩을 마친 뒤 첫 요청이 나간다.
 */
export function useLocationPermissionGuard() {
  useEffect(() => {
    checkLocationAndStartTracking();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkLocationAndStartTracking();
    });

    return () => subscription.remove();
  }, []);
}
