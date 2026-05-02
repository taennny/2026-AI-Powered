/**
 * @file hooks/usePermissions.ts
 * @description 앱 필수 권한 요청 훅
 * - 위치(foreground), 미디어 라이브러리, 카메라
 * - 앱 최초 진입 시 한 번 호출
 */

import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export function usePermissions() {
  const requestAll = async () => {
    await Location.requestForegroundPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
  };

  return {requestAll};
}
