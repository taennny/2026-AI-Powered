/**
 * @file app/(auth)/kakao-login.tsx
 * @description 카카오 OAuth 딥링크 콜백 처리 화면
 * - roameapp://kakao-login?accessToken=...&refreshToken=... 딥링크 수신
 * - tokenStorage 저장 + authStore 업데이트 후 홈으로 이동
 *
 * ## 다음 연결 작업
 * - [ ] 백엔드가 source 파라미터를 딥링크로 pass-through 하는지 확인 필요
 */

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

  const setToken = useAuthStore(state => state.setToken);

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
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
        setToken(accessToken);

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
  }, [accessToken, refreshToken, router, setToken, source]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}