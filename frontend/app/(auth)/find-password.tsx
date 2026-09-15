import {useState} from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';

import {sendResetEmail} from '@/services/authApi';
import BackButton from '@/components/common/BackButton';

// 자주 발생하는 이메일 도메인 오타와 올바른 도메인 매핑
const DOMAIN_DICTIONARY: Record<string, string> = {
  'gmail.co.kr': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',

  'naver.con': 'naver.com',
  'naver.co': 'naver.com',

  'daum.con': 'daum.net',
  'daum.co.kr': 'daum.net',

  'hanmail.con': 'hanmail.net',

  'nate.con': 'nate.com',
  'kakao.con': 'kakao.com',
};

// 기본적인 이메일 형식 검사
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FindPasswordScreen() {
  const [email, setEmail] = useState('');
  const [guideMessage, setGuideMessage] = useState('');
  const [guideColor, setGuideColor] = useState('#CCCCCC');
  const [suggestedEmail, setSuggestedEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isEmailValid = EMAIL_PATTERN.test(email);

  const handleEmailChange = (text: string) => {
    setEmail(text);

    // 기존 안내 메시지 초기화
    setGuideMessage('');
    setGuideColor('#CCCCCC');

    // 새로운 입력이 시작되면 기존 추천도 초기화
    setSuggestedEmail('');

    const [username, domain] = text.split('@');

    // @ 앞/뒤가 없으면 오타 검사하지 않음
    if (!username || !domain) {
      return;
    }

    // 입력한 도메인을 소문자로 변환해서 확인
    const correctedDomain =
      DOMAIN_DICTIONARY[domain.toLowerCase()];

    if (correctedDomain) {
      setSuggestedEmail(`${username}@${correctedDomain}`);
    }
  };

  // 추천된 이메일로 자동 수정
  const handleApplySuggestion = () => {
    if (!suggestedEmail) {
      return;
    }

    setEmail(suggestedEmail);
    setSuggestedEmail('');
  };

  const handleSendResetEmail = async () => {
    if (!isEmailValid || isLoading) {
      setGuideMessage('유효하지 않은 이메일 형식입니다.');
      setGuideColor('#FF3B30');
      return;
    }

    try {
      setIsLoading(true);
      setGuideMessage('');
      setGuideColor('#CCCCCC');

      await sendResetEmail(email);

      setGuideMessage('비밀번호 재설정 링크를 이메일로 보냈습니다.');
      setGuideColor('#4EF5F9');
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 422) {
        setGuideMessage('유효하지 않은 이메일 형식입니다.');
        setGuideColor('#FF3B30');
      } else {
        setGuideMessage('이메일 전송 중 오류가 발생했습니다.');
        setGuideColor('#FF3B30');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#F6F6F6] px-[42px] pt-[140px]">
        <BackButton />

        <Text className="text-[#111111] text-[22px] leading-[22px] font-black mb-[56px]">
          Roa{'\n'}me
        </Text>

        <View className="mb-[10px]">
  <View className="flex-row items-center justify-between mb-[6px]">
    <Text className="text-[12px] leading-[12px] text-[#3C3C43]">
      이메일
    </Text>

    <Text
      style={{color: guideColor}}
      className="text-[10px] leading-[10px]"
    >
      {guideMessage}
    </Text>
  </View>

  <TextInput
    value={email}
    onChangeText={handleEmailChange}
    placeholder="이메일을 입력해주세요."
    placeholderTextColor="#CCCCCC"
    autoCapitalize="none"
    keyboardType="email-address"
    className="h-[31px] rounded-[5px] border border-line px-[11px] text-[12px] text-[#3C3C43] bg-white"
  />

  <Text className="text-[10px] leading-[14px] text-[#8E8E93] mt-[5px]">
    기존 가입 이메일을 작성해주세요.{'\n'}
    가입 이메일이 아니면 메일이 발송되지 않습니다!
  </Text>

  {suggestedEmail && (
    <View className="flex-row items-center justify-end mt-[5px]">
      <Text className="text-[10px] text-[#8E8E93] mr-[5px]">
        혹시 {suggestedEmail}이 맞나요?
      </Text>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleApplySuggestion}
      >
        <Text className="text-[10px] text-primary font-bold">
          수정
        </Text>
      </TouchableOpacity>
    </View>
  )}
</View>

        <View className="flex-row justify-end mt-[12px]">
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isLoading}
            onPress={handleSendResetEmail}
            className="w-[90px] h-[22px] rounded-[4px] items-center justify-center bg-primary"
          >
            <Text className="text-[10px] leading-[10px] text-white">
              {isLoading ? '로딩중' : '메일 발송'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}