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
  Modal,
  ScrollView,
} from 'react-native';
import {useState} from 'react';
import {useRouter} from 'expo-router';

import {
  buildKakaoAuthUrl,
  KAKAO_APP_REDIRECT,
  KAKAO_REST_API_KEY,
} from '@/constants/kakao';
import ConsentList from '@/components/auth/ConsentList';
import {
  emptyConsents,
  hasAllRequired,
  type ConsentState,
} from '@/constants/consent';
import {
  hasAgreedToKakaoConsent,
  markKakaoConsentAgreed,
} from '@/utils/consentStorage';
import {saveTokens} from '@/utils/tokenStorage';
import {login} from '@/services/authApi';
import {useAuthStore} from '@/store/authStore';
import {logError} from '@/utils/logError';

export default function LoginScreen() {
  const router = useRouter();
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);

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

      // login()이 토큰을 디스크에 저장한다 — 여기서는 인증 플래그만 세운다
      await login({email, password});
      setAuthenticated();

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
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [consents, setConsents] = useState<ConsentState>(emptyConsents);

  /**
   * 카카오로 처음 들어오면 서버가 바로 계정을 만든다 — 회원가입 화면을 안 거치므로
   * 여기서 동의를 받지 않으면 위치 상시 수집 동의 없이 가입이 끝난다.
   * 한 번 받으면 기기에 남겨 다시 묻지 않는다(로그아웃해도 유지).
   */
  const handleKakaoPress = async () => {
    if (!KAKAO_REST_API_KEY) {
      setErrorMessage('카카오 로그인 설정이 없습니다.');
      return;
    }

    if (await hasAgreedToKakaoConsent()) {
      void startKakaoLogin();
      return;
    }
    setIsConsentOpen(true);
  };

  const handleConsentAgree = async () => {
    setIsConsentOpen(false);
    await markKakaoConsentAgreed();
    void startKakaoLogin();
  };

  const startKakaoLogin = async () => {
    try {
      // returnUrl은 앱 딥링크다. 백엔드 콜백을 주면
      // 토큰이 만들어지기 전에 세션이 닫힐 수 있다.
      const result = await WebBrowser.openAuthSessionAsync(
        buildKakaoAuthUrl(),
        KAKAO_APP_REDIRECT,
      );

      if (result.type !== 'success') {
        return;
      }

      if (!result.url) {
        throw new Error('Redirect URL이 없습니다.');
      }

      const {queryParams} = Linking.parse(result.url);
      const accessToken = queryParams?.accessToken;
      const refreshToken = queryParams?.refreshToken;

      if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
        throw new Error('토큰을 받지 못했습니다.');
      }

      await saveTokens(accessToken, refreshToken);
      setAuthenticated();

      router.replace('/');
    } catch (error) {
      logError('kakao login', error);
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
          onPress={handleKakaoPress}
          className="w-12 h-12 rounded-full bg-[#FEE500] self-center mt-6 items-center justify-center"
        >
          <Image
            source={require('../../assets/images/kakao.png')}
            style={{width: 55, height: 55}}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Modal
          visible={isConsentOpen}
          transparent
          // 아래에서 올라온다 — 가입 흐름을 끊지 않고 이어지는 느낌을 준다
          animationType="slide"
          onRequestClose={() => setIsConsentOpen(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{backgroundColor: 'rgba(0,0,0,0.4)'}}
          >
            <View className="h-2/3 rounded-t-[20px] bg-white px-6 pt-3 pb-6">
              {/* 시트라는 걸 알려주는 손잡이 */}
              <View className="w-10 h-1 rounded-full bg-[#E5E5EA] self-center mb-4" />

              <Text className="text-[15px] font-semibold text-[#1C1C1E]">
                가입 전 동의가 필요해요
              </Text>
              <Text className="mt-1 mb-4 text-[11px] leading-[15px] text-[#8E8E93]">
                카카오로 시작하면 계정이 만들어집니다. 아래 항목을 확인해주세요.
              </Text>

              {/* 남는 높이를 다 쓰고, 넘치면 스크롤한다 */}
              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
              >
                <ConsentList consents={consents} onChange={setConsents} />
              </ScrollView>

              <View className="flex-row justify-end mt-4">
                <TouchableOpacity
                  onPress={() => setIsConsentOpen(false)}
                  className="px-5 py-3"
                >
                  <Text className="text-[13px] text-[#8E8E93]">취소</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConsentAgree}
                  disabled={!hasAllRequired(consents)}
                  className={`ml-1 px-5 py-3 rounded-[8px] ${
                    hasAllRequired(consents) ? 'bg-primary' : 'bg-[#E5E5EA]'
                  }`}
                >
                  <Text
                    className={`text-[13px] ${
                      hasAllRequired(consents) ? 'text-white' : 'text-[#8E8E93]'
                    }`}
                  >
                    동의하고 계속
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}
