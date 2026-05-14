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
