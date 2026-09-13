import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import {useCallback, useState} from 'react';
import {useRouter} from 'expo-router';

import KakaoConsentSheet from '@/components/auth/KakaoConsentSheet';
import {useEmailLogin} from '@/hooks/useEmailLogin';
import {useKakaoLogin} from '@/hooks/useKakaoLogin';

export default function LoginScreen() {
  const router = useRouter();

  // 이메일·카카오가 같은 자리에 문구를 띄운다 — 화면이 들고 양쪽에 넘긴다
  const [errorMessage, setErrorMessage] = useState('');
  const showError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const {email, setEmail, password, setPassword, isLoading, submit} =
    useEmailLogin({onError: showError});
  const kakao = useKakaoLogin({onError: showError});

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
          onPress={() => void submit()}
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
          onPress={() => void kakao.start()}
          className="w-12 h-12 rounded-full bg-[#FEE500] self-center mt-6 items-center justify-center"
        >
          <Image
            source={require('../../assets/images/kakao.png')}
            style={{width: 55, height: 55}}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <KakaoConsentSheet
          visible={kakao.isConsentOpen}
          consents={kakao.consents}
          onChange={kakao.setConsents}
          onAgree={kakao.agree}
          onCancel={() => void kakao.cancel()}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}
