import {useMemo, useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import {signup} from '../lib/authApi';

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isServiceTermsChecked, setIsServiceTermsChecked] = useState(false);
  const [isPrivacyPolicyChecked, setIsPrivacyPolicyChecked] = useState(false);
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);

  const [emailGuideMessage, setEmailGuideMessage] = useState('');
  const [emailGuideColor, setEmailGuideColor] = useState('#CCCCCC');

  const [passwordGuideMessage, setPasswordGuideMessage] = useState('');
  const [passwordGuideColor, setPasswordGuideColor] = useState('#CCCCCC');

  const isSignupButtonEnabled = useMemo(() => {
    return (
      email.includes('@') &&
      password.length >= 8 &&
      isServiceTermsChecked &&
      isPrivacyPolicyChecked &&
      isAgeConfirmed
    );
  }, [
    email,
    password,
    isServiceTermsChecked,
    isPrivacyPolicyChecked,
    isAgeConfirmed,
  ]);

  const handleEmailChange = (text: string) => {
    setEmail(text);

    if (!text) {
      setEmailGuideMessage('');
      setEmailGuideColor('#CCCCCC');
      return;
    }

    if (text.includes('@')) {
      setEmailGuideMessage('사용 가능한 아이디입니다.');
      setEmailGuideColor('#4EF5F9');
      return;
    }

    setEmailGuideMessage('');
    setEmailGuideColor('#CCCCCC');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);

    if (!text) {
      setPasswordGuideMessage('');
      setPasswordGuideColor('#CCCCCC');
      return;
    }

    if (text.length >= 8) {
      setPasswordGuideMessage('사용 가능한 비밀번호입니다.');
      setPasswordGuideColor('#4EF5F9');
      return;
    }

    setPasswordGuideMessage('비밀번호 형식이 아닙니다.');
    setPasswordGuideColor('#FF0000');
  };

  const handleSignupPress = async () => {
    if (!isSignupButtonEnabled || isLoading) {
      return;
    }

    try {
      setIsLoading(true);
      setEmailGuideMessage('');
      setPasswordGuideMessage('');

      await signup({
        email,
        password,
      });

      router.replace('/login');
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 400) {
        setPasswordGuideMessage('이메일 형식 또는 비밀번호 조건을 확인해주세요.');
        setPasswordGuideColor('#FF3B30');
      } else if (status === 409) {
        setEmailGuideMessage('중복된 아이디입니다.');
        setEmailGuideColor('#FF3B30');
      } else {
        setEmailGuideMessage('회원가입 중 오류가 발생했습니다.');
        setEmailGuideColor('#FF3B30');
      }

      console.log('signup error', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkboxBaseStyle =
    'w-[11px] h-[11px] rounded-full border border-[#BDBDBD] items-center justify-center mr-[6px]';

  const checkboxInnerStyle = 'w-[5px] h-[5px] rounded-full bg-[#BDBDBD]';

  return (
    <View className="flex-1 bg-[#F7F7F7] px-[42px] pt-[140px]">
      <Text className="text-[#111111] text-[22px] leading-[22px] font-black mb-[56px]">
        Roa{'\n'}me
      </Text>

      <View className="mb-[10px]">
        <View className="flex-row items-center justify-between mb-[6px]">
          <Text className="text-[12px] leading-[12px] text-[#3C3C43]">
            이메일
          </Text>
          <Text
            style={{color: emailGuideColor}}
            className="text-[10px] leading-[10px]"
          >
            {emailGuideMessage}
          </Text>
        </View>

        <TextInput
          value={email}
          onChangeText={handleEmailChange}
          placeholder="이메일을 입력해주세요."
          placeholderTextColor="#CCCCCC"
          autoCapitalize="none"
          keyboardType="email-address"
          className="h-[31px] rounded-[5px] border border-[#D9D9D9] px-[11px] text-[12px] text-[#3C3C43] bg-white"
        />
      </View>

      <View className="mb-[6px]">
        <View className="flex-row items-center justify-between mb-[6px]">
          <Text className="text-[12px] leading-[12px] text-[#3C3C43]">
            비밀번호
          </Text>
          <Text
            style={{color: passwordGuideColor}}
            className="text-[10px] leading-[10px]"
          >
            {passwordGuideMessage}
          </Text>
        </View>

        <TextInput
          value={password}
          onChangeText={handlePasswordChange}
          placeholder="비밀번호를 입력해주세요."
          placeholderTextColor="#CCCCCC"
          secureTextEntry
          autoCapitalize="none"
          className="h-[31px] rounded-[5px] border border-[#D9D9D9] px-[11px] text-[12px] text-[#3C3C43] bg-white"
        />

        <Text className="text-[9px] leading-[9px] text-[#CCCCCC] text-right mt-[4px]">
          8자 이상, 특수문자 포함
        </Text>
      </View>

      <View className="mt-[18px] mb-[20px]">
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setIsServiceTermsChecked(previousValue => !previousValue)
          }
          className="flex-row items-center mb-[8px]"
        >
          <View className={checkboxBaseStyle}>
            {isServiceTermsChecked ? (
              <View className={checkboxInnerStyle} />
            ) : null}
          </View>
          <Text className="text-[11px] leading-[11px] text-[#6E6E73] flex-1">
            서비스 이용약관 동의
          </Text>
          <Text className="text-[12px] leading-[12px] text-[#9A9A9A]">
            {'>'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            setIsPrivacyPolicyChecked(previousValue => !previousValue)
          }
          className="flex-row items-center mb-[8px]"
        >
          <View className={checkboxBaseStyle}>
            {isPrivacyPolicyChecked ? (
              <View className={checkboxInnerStyle} />
            ) : null}
          </View>
          <Text className="text-[11px] leading-[11px] text-[#6E6E73] flex-1">
            개인정보 수집 및 이용 동의
          </Text>
          <Text className="text-[12px] leading-[12px] text-[#9A9A9A]">
            {'>'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsAgeConfirmed(previousValue => !previousValue)}
          className="flex-row items-center"
        >
          <View className={checkboxBaseStyle}>
            {isAgeConfirmed ? <View className={checkboxInnerStyle} /> : null}
          </View>
          <Text className="text-[11px] leading-[11px] text-[#6E6E73]">
            만 14세 이상입니다.
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!isSignupButtonEnabled || isLoading}
        onPress={handleSignupPress}
        className={`self-end w-[58px] h-[22px] rounded-[4px] items-center justify-center ${
          isSignupButtonEnabled ? 'bg-[#191F28]' : 'bg-[#E5E5EA]'
        }`}
      >
        <Text
          className={`text-[10px] leading-[10px] ${
            isSignupButtonEnabled ? 'text-white' : 'text-[#8E8E93]'
          }`}
        >
          {isLoading ? '로딩중' : '회원가입'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}