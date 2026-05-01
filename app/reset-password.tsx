import {useMemo, useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {resetPassword} from '../lib/authApi';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const {token} = useLocalSearchParams<{token?: string}>();

  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isPasswordValid = useMemo(() => {
    const passwordPattern =
      /^(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]{8,}$/;
    return passwordPattern.test(newPassword);
  }, [newPassword]);

  const passwordGuideMessage = useMemo(() => {
    if (errorMessage) {
      return errorMessage;
    }

    if (!newPassword) {
      return '';
    }

    if (isPasswordValid) {
      return '사용 가능한 비밀번호입니다.';
    }

    return '올바른 형식이 아닙니다.';
  }, [errorMessage, isPasswordValid, newPassword]);

  const passwordGuideColor = useMemo(() => {
    if (errorMessage) {
      return '#FF3B30';
    }

    if (!newPassword) {
      return '#CCCCCC';
    }

    if (isPasswordValid) {
      return '#4EF5F9';
    }

    return '#FF3B30';
  }, [errorMessage, isPasswordValid, newPassword]);

  const handleResetPasswordPress = async () => {
    if (!isPasswordValid || isLoading) {
      return;
    }

    if (!token || typeof token !== 'string') {
      setErrorMessage('재설정 링크가 유효하지 않습니다.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage('');

      await resetPassword(token, newPassword);

      router.replace('/login');
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 400) {
        setErrorMessage('토큰이 만료되었거나 유효하지 않습니다.');
      } else {
        setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
      }

      console.log('reset password error', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F7F7F7] px-[42px] pt-[140px]">
      <Text className="text-[#111111] text-[22px] leading-[22px] font-black mb-[92px]">
        Roa{'\n'}me
      </Text>

      <View className="mb-[22px]">
        <View className="flex-row items-center justify-between mb-[6px]">
          <Text className="text-[12px] leading-[12px] text-[#3C3C43]">
            새 비밀번호 입력
          </Text>
          <Text
            style={{color: passwordGuideColor}}
            className="text-[10px] leading-[10px]"
          >
            {passwordGuideMessage}
          </Text>
        </View>

        <TextInput
          value={newPassword}
          onChangeText={(text) => {
            setNewPassword(text);
            setErrorMessage('');
          }}
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

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={!isPasswordValid || isLoading}
        onPress={handleResetPasswordPress}
        className={`self-end w-[90px] h-[22px] rounded-[4px] items-center justify-center ${
          isPasswordValid ? 'bg-[#191F28]' : 'bg-[#E5E5EA]'
        }`}
      >
        <Text
          className={`text-[10px] leading-[10px] ${
            isPasswordValid ? 'text-white' : 'text-[#8E8E93]'
          }`}
        >
          {isLoading ? '로딩중' : '비밀번호 변경'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}