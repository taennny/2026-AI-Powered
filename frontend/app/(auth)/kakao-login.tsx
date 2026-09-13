import {useEffect} from 'react';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {ActivityIndicator, Alert, View} from 'react-native';

import {parseIsNewUser} from '@/constants/kakao';
import {useAuthStore} from '@/store/authStore';
import {saveTokens} from '@/utils/tokenStorage';
import {logError} from '@/utils/logError';

export default function KakaoLoginScreen() {
  const router = useRouter();

  const {accessToken, refreshToken, source, isNewUser} = useLocalSearchParams<{
    accessToken?: string;
    refreshToken?: string;
    source?: string;
    isNewUser?: string;
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

        // 신규 가입자는 여기서 들여보내지 않는다 — 동의를 아직 안 받았다.
        // 로그인 화면이 같은 시트를 띄우고, 거부하면 만들어진 계정을 지운다.
        if (parseIsNewUser(isNewUser)) {
          router.replace('/(auth)/login?consent=1');
          return;
        }

        setAuthenticated();

        if (source === 'account-link') {
          router.replace('/(main)/settings/account');
          return;
        }

        router.replace('/(main)/(tabs)/home');
      } catch (error) {
        logError('kakao deeplink', error);

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
  }, [accessToken, refreshToken, isNewUser, router, setAuthenticated, source]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
