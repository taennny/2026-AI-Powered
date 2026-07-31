import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export function usePermissions() {
  const requestAll = async () => {
    await Location.requestForegroundPermissionsAsync();
    await Location.requestBackgroundPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await ImagePicker.requestCameraPermissionsAsync();
  };

  return {requestAll};
}
