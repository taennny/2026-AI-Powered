import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {View, ActivityIndicator} from 'react-native';
import {getAccessToken} from '../../lib/tokenStorage';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    requestPermissionsAndCheckLogin();
  }, []);

  const requestPermissionsAndCheckLogin = async () => {
    try {
      const locationPermission =
        await Location.requestForegroundPermissionsAsync();

      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();

      console.log('권한 상태:', {
        location: locationPermission.status,
        media: mediaPermission.status,
        camera: cameraPermission.status,
      });

      const accessToken = await getAccessToken();

      if (accessToken) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.log('권한 요청 에러:', error);
      router.replace('/login');
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <ActivityIndicator size="large" />
    </View>
  );
}