import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import {useState} from 'react';
import {useRouter} from 'expo-router';

import {
  buildKakaoAuthUrl,
  KAKAO_REDIRECT_URI,
  KAKAO_REST_API_KEY,
} from '@/constants/kakao';
import {saveTokens} from '@/utils/tokenStorage';
import {login} from '@/services/authApi';
import {useAuthStore} from '@/store/authStore';
import {useGpsTracking} from '@/hooks/useGpsTracking';

export default function LoginScreen() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);
  const {start: startGps} = useGpsTracking();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginFailCount, setLoginFailCount] = useState(0);

  const handleLoginPress = async () => {
    if (loginFailCount >= 5) {
      setErrorMessage('5회 이상 실패하여 로그인이 제한되었습니다.');
      return;
    }

    if (!email || !password) {
      setErrorMessage('이메일 또는 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      const {access_token} = await login({email, password});
      setToken(access_token);

      await startGps();

      router.replace('/');
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 401) {
        const nextFailCount = loginFailCount + 1;
        setLoginFailCount(nextFailCount);

        if (nextFailCount >= 5) {
          setErrorMessage('5회 이상 실패하여 로그인이 제한되었습니다.');
        } else {
          setErrorMessage('이메일 또는 비밀번호가 일치하지 않습니다.');
        }
      } else if (status === 400) {
        setErrorMessage('요청 형식이 올바르지 않습니다.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  const handleKakaoLogin = async () => {
    if (!KAKAO_REST_API_KEY) {
      setErrorMessage('카카오 로그인 설정이 없습니다.');
      return;
    }

    try {
      const result = await WebBrowser.openAuthSessionAsync(
        buildKakaoAuthUrl(),
        KAKAO_REDIRECT_URI,
      );

      if (result.type !== 'success') return;

      if (!result.url) {
        throw new Error('Redirect URL이 없습니다.');
      }

      const {queryParams} = Linking.parse(result.url);
      const accessToken = queryParams?.accessToken;
      const refreshToken = queryParams?.refreshToken;

      if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
        throw new Error('토큰을 받지 못했습니다.');
      }

      // authApi의 login()과 달리 여기서 직접 저장한다 — 디스크와 메모리 둘 다
      await saveTokens(accessToken, refreshToken);
      setToken(accessToken);

      // TODO: isNewUser === 'true'면 추후 회원정보 입력 화면으로 분기
      router.replace('/');
    } catch (error) {
      console.log('kakao login error', error);
      setErrorMessage('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-white px-6 justify-center">
        <Text className="text-[64px] leading-[64px] font-black text-[#1E1E1E] mb-12">
          Roa{'\n'}me
        </Text>

        <View className="space-y-3">
          <TextInput
            placeholder="ID"
            placeholderTextColor="#8E8E93"
            value={email}
            onChangeText={text => {
              setEmail(text);
              setErrorMessage('');
            }}
            className="border border-line rounded-md px-4 py-3 text-[16px]"
          />

          <TextInput
            placeholder="PASSWORD"
            placeholderTextColor="#8E8E93"
            secureTextEntry
            value={password}
            onChangeText={text => {
              setPassword(text);
              setErrorMessage('');
            }}
            className="border border-line rounded-md px-4 py-3 text-[16px]"
          />

          {errorMessage ? (
            <Text className="text-[#FF3B30] text-[12px] mt-1">
              {errorMessage}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          disabled={isLoading}
          onPress={handleLoginPress}
          className="bg-primary rounded-md py-3 mt-5"
        >
          <Text className="text-white text-center text-[16px] font-semibold">
            {isLoading ? '로딩중' : '로그인'}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4 space-x-4">
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text className="text-[#8E8E93] text-[12px]">회원가입</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/find-password')}
          >
            <Text className="text-[#8E8E93] text-[12px]">비밀번호 찾기</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleKakaoLogin}
          className="w-12 h-12 rounded-full bg-[#FEE500] self-center mt-6 items-center justify-center"
        >
          <Image
            source={require('../../assets/images/kakao.png')}
            style={{width: 55, height: 55}}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
}
