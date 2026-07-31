import {useEffect} from 'react';
import {Alert, AppState, Linking} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import {PERMISSION_MESSAGES} from '@/constants/permissionMessages';
import {startGpsTracking} from '@/hooks/useGpsTracking';

type PermissionMessage = {title: string; message: string};

// 안내가 겹쳐 쌓이는 것을 막는다. 권한 확인은 진입·복귀마다 돌기 때문에
// 플래그가 없으면 같은 Alert이 여러 장 뜬다.
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

/**
 * 위치 권한(포그라운드 → 백그라운드)을 확인한다.
 * 아직 물어볼 수 있으면 시스템 다이얼로그를 띄우고, 이미 거부된 상태면 설정 안내를 띄운다.
 */
export async function ensureLocationPermissions(): Promise<boolean> {
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

/** 사진 첨부 직전에 호출한다. false면 호출부는 picker를 열지 않는다. */
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

/** 권한이 확보되면 추적을 시작한다 — 설정에서 뒤늦게 허용한 경우도 여기서 살아난다. */
async function checkLocationAndStartTracking() {
  const granted = await ensureLocationPermissions();
  if (granted) await startGpsTracking();
}

/**
 * 앱 진입과 포그라운드 복귀마다 위치 권한을 확인한다.
 * (main) 레이아웃에 한 번만 마운트한다 — 온보딩은 (main) 바깥이라
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
