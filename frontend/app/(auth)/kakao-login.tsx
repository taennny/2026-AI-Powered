import {useEffect} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {View, ActivityIndicator} from 'react-native';

import {saveTokens} from '@/utils/tokenStorage';
import {useAuthStore} from '@/store/authStore';

export default function KakaoLoginScreen() {
  const router = useRouter();
  const {accessToken, refreshToken, source} = useLocalSearchParams();
  const setToken = useAuthStore(s => s.setToken);

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
        if (accessToken && refreshToken) {
          await saveTokens(accessToken as string, refreshToken as string);
          setToken(accessToken as string);
          if (source === 'account-link') {
            router.replace('/(main)/settings/account');
          } else {
            router.replace('/(main)/(tabs)/home');
          }
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
