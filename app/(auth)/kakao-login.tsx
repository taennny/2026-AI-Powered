import {useEffect} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {View, ActivityIndicator} from 'react-native';
import {saveTokens} from '@/utils/tokenStorage';

export default function KakaoLoginScreen() {
  const router = useRouter();
  const {accessToken, refreshToken} = useLocalSearchParams();

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
        if (accessToken && refreshToken) {
          await saveTokens(accessToken as string, refreshToken as string);
          router.replace('/(main)/(tabs)/home');
        } else {
          router.replace('/(auth)/login');
        }
      } catch {
        router.replace('/(auth)/login');
      }
    };

    handleKakaoLogin();
  }, []);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
