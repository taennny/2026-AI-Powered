import * as Linking from 'expo-linking';
import { saveTokens } from '@/utils/tokenStorage';
import * as WebBrowser from 'expo-web-browser';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Alert,
} from 'react-native';
import {useState} from 'react';
import {useRouter} from 'expo-router';

import {login} from '@/services/authApi';
import {useAuthStore} from '@/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const setToken = useAuthStore(s => s.setToken);

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
  try {
    const CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const REDIRECT_URI = process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI;

if (!CLIENT_ID || !REDIRECT_URI) {
  Alert.alert(
    '카카오 로그인 오류',
    '카카오 로그인 설정을 확인할 수 없습니다.',
  );
  return;
}

    const authUrl =
      `https://kauth.kakao.com/oauth/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code`;

    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      REDIRECT_URI,
    );

    if (result.type !== 'success') {
      return;
    }

    if (!result.url) {
      throw new Error('Redirect URL이 없습니다.');
    }

    const { queryParams } = Linking.parse(result.url);

const accessToken = queryParams?.accessToken;
const refreshToken = queryParams?.refreshToken;
const isNewUser = queryParams?.isNewUser;

if (
  typeof accessToken !== 'string' ||
  typeof refreshToken !== 'string'
) {
  throw new Error('토큰을 받지 못했습니다.');
}

// authApi의 login()처럼 토큰 저장
await saveTokens(accessToken, refreshToken);

setToken(accessToken);

// 필요하면 신규 회원 분기
if (isNewUser === 'true') {
  router.replace('/');
  // 추후 회원정보 입력 화면으로 변경 가능
} else {
  router.replace('/');
}
  } catch (error) {
  console.error('kakao login error', error);

  Alert.alert(
    '카카오 로그인 실패',
    '로그인 중 오류가 발생했습니다. 다시 시도해주세요.',
  );
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