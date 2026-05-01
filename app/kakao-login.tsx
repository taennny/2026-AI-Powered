import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { saveTokens } from '../lib/tokenStorage';

export default function KakaoLoginScreen() {
  const router = useRouter();
  const { accessToken, refreshToken } = useLocalSearchParams();

  useEffect(() => {
    const handleKakaoLogin = async () => {
      try {
        // 토큰이 정상적으로 전달된 경우
        if (accessToken && refreshToken) {
          await saveTokens(accessToken as string, refreshToken as string);

          // 메인 화면으로 이동
          router.replace('/(tabs)');
        } else {
          console.log('카카오 토큰 없음');
          router.replace('/login');
        }
      } catch (error) {
        console.log('카카오 로그인 처리 에러', error);
        router.replace('/login');
      }
    };

    handleKakaoLogin();
  }, []);

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