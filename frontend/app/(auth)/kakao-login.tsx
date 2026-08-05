import {useEffect} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ActivityIndicator, View} from 'react-native';

import {useAuthStore} from '@/store/authStore';
import {saveTokens} from '@/utils/tokenStorage';

export default function KakaoLoginScreen() {
  const router = useRouter();

  const {accessToken, refreshToken, source} = useLocalSearchParams<{
    accessToken?: string;
    refreshToken?: string;
    source?: string;
  }>();

  const setToken = useAuthStore(state => state.setToken);

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
        if (!accessToken || !refreshToken) {
          router.replace('/(auth)/login');
          return;
        }

        await saveTokens(accessToken, refreshToken);
        setToken(accessToken);

        if (source === 'account-link') {
          router.replace('/(main)/settings/account');
          return;
        }

        router.replace('/(main)/(tabs)/home');
      } catch (error) {
        console.log('카카오 딥링크 처리 오류:', error);
        router.replace('/(auth)/login');
      }
    };

    void handleKakaoLogin();
  }, [accessToken, refreshToken, router, setToken, source]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}