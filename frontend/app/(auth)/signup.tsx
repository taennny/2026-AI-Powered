import {useMemo, useState} from 'react';
import {
  Alert,
  Linking,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import {useRouter} from 'expo-router';

import {signup} from '@/services/authApi';
import BackButton from '@/components/common/BackButton';
import {PRIVACY_POLICY_URL} from '@/constants/legal';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

const NICKNAME_REGEX = /^[가-힣A-Za-z0-9]{2,10}$/;

/**
 * 회원가입 동의 항목. 조 번호는 개인정보처리방침 문서와 짝이라
 * **문서를 고치면 여기도 같이 봐야 한다.**
 *
 * `detail`이 있는 항목만 '자세히 보기'를 띄운다 — 나이 확인과 선택 동의는
 * 문서에 대응하는 조항이 없다.
 */
const CONSENT_ITEMS = [
  {id: 'age', required: true, label: '만 14세 이상입니다', detail: false},
  {
    id: 'privacy',
    required: true,
    label: '제1조 개인정보 수집·이용 동의',
    detail: true,
  },
  {
    id: 'location',
    required: true,
    label: '제2조 개인위치정보 백그라운드 상시 수집·이용 동의',
    detail: true,
  },
  {
    id: 'transfer',
    required: true,
    label: '제3조 개인정보 처리위탁 및 국외 이전 동의',
    detail: true,
  },
  {
    id: 'notice',
    required: true,
    label: '제4·5조 안내 사항 확인 (사진 자동 업로드, 베타테스트 특약)',
    detail: true,
  },
  {
    id: 'research',
    required: false,
    label: '서비스 개선 설문·인터뷰 요청 연락 수신',
    detail: false,
  },
] as const;

type ConsentId = (typeof CONSENT_ITEMS)[number]['id'];

export default function SignupScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [consents, setConsents] = useState<Record<ConsentId, boolean>>(
    () =>
      Object.fromEntries(CONSENT_ITEMS.map(item => [item.id, false])) as Record<
        ConsentId,
        boolean
      >,
  );

  const toggleConsent = (id: ConsentId) =>
    setConsents(prev => ({...prev, [id]: !prev[id]}));

  const openPrivacyPolicy = async () => {
    try {
      await Linking.openURL(PRIVACY_POLICY_URL);
    } catch {
      Alert.alert('오류', '페이지를 열지 못했어요. 다시 시도해주세요.');
    }
  };

  const [emailGuideMessage, setEmailGuideMessage] = useState('');
  const [emailGuideColor, setEmailGuideColor] = useState('#CCCCCC');

  const [passwordGuideMessage, setPasswordGuideMessage] = useState('');
  const [passwordGuideColor, setPasswordGuideColor] = useState('#CCCCCC');

  const [nicknameGuideMessage, setNicknameGuideMessage] = useState('');
  const [nicknameGuideColor, setNicknameGuideColor] = useState('#CCCCCC');

  const isSignupButtonEnabled = useMemo(() => {
    // 선택 항목은 가입을 막지 않는다
    const requiredAgreed = CONSENT_ITEMS.filter(item => item.required).every(
      item => consents[item.id],
    );

    return (
      EMAIL_REGEX.test(email.trim()) &&
      PASSWORD_REGEX.test(password) &&
      NICKNAME_REGEX.test(nickname.trim()) &&
      requiredAgreed
    );
  }, [email, password, nickname, consents]);

  const handleEmailChange = (text: string) => {
    setEmail(text);

    const trimmedEmail = text.trim();

    if (!trimmedEmail) {
      setEmailGuideMessage('');
      setEmailGuideColor('#CCCCCC');
      return;
    }

    if (EMAIL_REGEX.test(trimmedEmail)) {
      setEmailGuideMessage('사용 가능한 이메일 형식입니다.');
      setEmailGuideColor('#4EF5F9');
      return;
    }

    setEmailGuideMessage('이메일 형식을 확인해주세요.');
    setEmailGuideColor('#FF3B30');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (!text) {
      setPasswordGuideMessage('');
      setPasswordGuideColor('#CCCCCC');
      return;
    }
    if (PASSWORD_REGEX.test(text)) {
      setPasswordGuideMessage('사용 가능한 비밀번호입니다.');
      setPasswordGuideColor('#4EF5F9');
      return;
    }
    setPasswordGuideMessage('비밀번호 형식이 아닙니다.');
    setPasswordGuideColor('#FF0000');
  };

  const handleNicknameChange = (text: string) => {
    setNickname(text);

    const trimmed = text.trim();

    if (!trimmed) {
      setNicknameGuideMessage('');
      setNicknameGuideColor('#CCCCCC');
      return;
    }

    if (NICKNAME_REGEX.test(trimmed)) {
      setNicknameGuideMessage('사용 가능한 닉네임입니다.');
      setNicknameGuideColor('#4EF5F9');
      return;
    }

    setNicknameGuideMessage('2~10자의 한글, 영문, 숫자만 가능합니다.');
    setNicknameGuideColor('#FF3B30');
  };

  const handleSignupPress = async () => {
    if (!isSignupButtonEnabled || isLoading) return;

    try {
      setIsLoading(true);
      setEmailGuideMessage('');
      setPasswordGuideMessage('');
      setNicknameGuideMessage('');

      await signup({email: email.trim(), password, nickname: nickname.trim()});

      router.replace('/(auth)/login');
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 400 || status === 422) {
        setPasswordGuideMessage(
          '이메일 형식 또는 비밀번호 조건을 확인해주세요.',
        );
        setPasswordGuideColor('#FF3B30');
      } else if (status === 409) {
        setEmailGuideMessage('중복된 이메일입니다.');
        setEmailGuideColor('#FF3B30');
      } else {
        setEmailGuideMessage('회원가입 중 오류가 발생했습니다.');
        setEmailGuideColor('#FF3B30');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkboxBaseStyle =
    'w-[11px] h-[11px] rounded-full border border-[#BDBDBD] items-center justify-center mr-[6px]';
  const checkboxInnerStyle = 'w-[5px] h-[5px] rounded-full bg-[#BDBDBD]';

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
            className="h-[31px] rounded-[5px] border border-line px-[11px] text-[12px] text-[#3C3C43] bg-white"
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
            className="h-[31px] rounded-[5px] border border-line px-[11px] text-[12px] text-[#3C3C43] bg-white"
          />
          <Text className="text-[9px] leading-[9px] text-[#CCCCCC] text-right mt-[4px]">
            8자 이상, 영문·숫자·특수문자를 모두 포함해주세요.
          </Text>
        </View>

        <View className="mb-[10px]">
          <View className="flex-row items-center justify-between mb-[6px]">
            <Text className="text-[12px] leading-[12px] text-[#3C3C43]">
              닉네임
            </Text>
            <Text
              style={{color: nicknameGuideColor}}
              className="text-[10px] leading-[10px]"
            >
              {nicknameGuideMessage}
            </Text>
          </View>
          <TextInput
            value={nickname}
            onChangeText={handleNicknameChange}
            placeholder="닉네임을 입력해주세요."
            placeholderTextColor="#CCCCCC"
            autoCapitalize="none"
            className="h-[31px] rounded-[5px] border border-line px-[11px] text-[12px] text-[#3C3C43] bg-white"
          />
        </View>
        <View className="mt-[18px] mb-[20px]">
          {CONSENT_ITEMS.map(item => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => toggleConsent(item.id)}
              className="flex-row items-start mb-[8px]"
            >
              <View className={checkboxBaseStyle}>
                {consents[item.id] ? (
                  <View className={checkboxInnerStyle} />
                ) : null}
              </View>

              <Text className="text-[11px] leading-[15px] text-[#6E6E73] flex-1">
                <Text
                  className={
                    item.required ? 'text-[#6E6E73]' : 'text-[#9A9A9A]'
                  }
                >
                  {item.required ? '(필수) ' : '(선택) '}
                </Text>
                {item.label}
              </Text>

              {/* 체크와 다른 동작이라 따로 눌리게 한다 — 문서를 보려다 동의가 켜지면 안 된다 */}
              {item.detail ? (
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={openPrivacyPolicy}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  className="pl-2"
                >
                  <Text className="text-[11px] leading-[15px] text-[#9A9A9A] underline">
                    자세히 보기
                  </Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!isSignupButtonEnabled || isLoading}
          onPress={handleSignupPress}
          className={`self-end w-[58px] h-[22px] rounded-[4px] items-center justify-center ${
            isSignupButtonEnabled ? 'bg-primary' : 'bg-[#E5E5EA]'
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
    </TouchableWithoutFeedback>
  );
}
