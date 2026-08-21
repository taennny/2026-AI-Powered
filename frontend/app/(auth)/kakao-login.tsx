import {useEffect} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ActivityIndicator, Alert, View} from 'react-native';

import {useAuthStore} from '@/store/authStore';
import {saveTokens} from '@/utils/tokenStorage';

export default function KakaoLoginScreen() {
  const router = useRouter();

  const {accessToken, refreshToken, source} = useLocalSearchParams<{
    accessToken?: string;
    refreshToken?: string;
    source?: string;
  }>();

  const setAuthenticated = useAuthStore(state => state.setAuthenticated);

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
        if (source === 'account-link') {
  router.replace('/(main)/settings/account');
  return;
}
        if (!accessToken || !refreshToken) {
  Alert.alert(
    '카카오 로그인 실패',
    '로그인 정보를 확인할 수 없습니다. 다시 시도해주세요.',
    [
      {
        text: '확인',
        onPress: () => router.replace('/(auth)/login'),
      },
    ],
  );
  return;
}

        await saveTokens(accessToken, refreshToken);
        setAuthenticated();

        if (source === 'account-link') {
          router.replace('/(main)/settings/account');
          return;
        }

        router.replace('/(main)/(tabs)/home');
      } catch (error) {
  console.error('카카오 딥링크 처리 오류:', error);

  Alert.alert(
    '카카오 로그인 실패',
    '로그인 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
    [
      {
        text: '확인',
        onPress: () => router.replace('/(auth)/login'),
      },
    ],
  );
}
    };

    void handleKakaoLogin();
  }, [accessToken, refreshToken, router, setAuthenticated, source]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}