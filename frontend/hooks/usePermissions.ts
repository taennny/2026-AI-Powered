import {useEffect} from 'react';
import {Alert, AppState, Linking} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import {PERMISSION_MESSAGES} from '@/constants/permissionMessages';
import {startGpsTracking} from '@/hooks/useGpsTracking';
import {useSettingsStore} from '@/store/settingsStore';

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
 * 사진 첨부 직전에 호출한다. false면 호출부는 picker를 열지 않는다.
 * 포스팅 사진 기능이 빠지면서 현재 호출부가 없다 — '사진 모아보기'가 들어올 때
 * 다시 쓰려고 남겨둔 것이므로 미사용이라고 지우지 말 것.
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
 * 사진 라이브러리 접근을 확인한다. 타임라인 카드에 그날 찍은 사진을 자동으로
 * 넣기 위한 것이라 사용자 조작 없이 백그라운드에서 쓰인다.
 *
 * 위치와는 **완전히 별개 권한**이고(iOS `NSPhotoLibraryUsageDescription`),
 * 거부해도 앱의 나머지는 그대로 동작하므로 설정 안내를 띄우지 않는다 —
 * 위치처럼 필수가 아닌데 알림을 쌓으면 성가시기만 하다.
 */
async function ensurePhotoLibraryPermission(): Promise<boolean> {
  let permission = await MediaLibrary.getPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) {
    permission = await MediaLibrary.requestPermissionsAsync();
  }
  return permission.status === 'granted';
}

/**
 * 권한이 확보되면 추적을 시작한다 — 설정에서 뒤늦게 허용한 경우도 여기서 살아난다.
 *
 * 사진 권한은 위치를 다 받은 **뒤에** 이어서 묻는다. 시스템 다이얼로그를 동시에
 * 띄우면 뒤엣것이 무시되고, 위치가 이 앱의 본질이라 순서가 먼저다.
 */
async function checkLocationAndStartTracking() {
  const granted = await ensureLocationPermissions();

  if (granted) {
    // 사용자가 설정에서 껐으면 권한이 있어도 시작하지 않는다.
    // 복원 전이면 기본값(켬)이라 잠깐 켜졌다 꺼지는 대신, 복원을 기다린다.
    const settings = useSettingsStore.getState();
    if (!settings.hasLoaded) await settings.initialize();
    if (useSettingsStore.getState().isTrackingEnabled) {
      await startGpsTracking();
    }
  }

  // 사진은 위치와 독립적인 기능이다. 위치를 "앱 사용 중에만"으로 두거나
  // 거부한 사용자도 타임라인 사진은 쓸 수 있어야 하므로, 위치 결과와
  // 무관하게 묻는다. (순서만 위치 뒤 — 시스템 다이얼로그가 겹치면
  // 뒤엣것이 무시된다)
  await ensurePhotoLibraryPermission();
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
