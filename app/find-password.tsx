import {useState} from 'react';
import {Text, TextInput, TouchableOpacity, View} from 'react-native';
import {useRouter} from 'expo-router';
import {sendResetEmail} from '../lib/authApi';

export default function FindPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [guideMessage, setGuideMessage] = useState('');
  const [guideColor, setGuideColor] = useState('#CCCCCC');
  const [isLoading, setIsLoading] = useState(false);

  const isEmailValid = email.includes('@');

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

      console.log('send reset email error', error);
    } finally {
      setIsLoading(false);
    }
  };

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
            style={{color: guideColor}}
            className="text-[10px] leading-[10px]"
          >
            {guideMessage}
          </Text>
        </View>

        <TextInput
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setGuideMessage('');
            setGuideColor('#CCCCCC');
          }}
          placeholder="이메일을 입력해주세요."
          placeholderTextColor="#CCCCCC"
          autoCapitalize="none"
          keyboardType="email-address"
          className="h-[31px] rounded-[5px] border border-[#D9D9D9] px-[11px] text-[12px] text-[#3C3C43] bg-white"
        />
      </View>

      <View className="flex-row justify-end mt-[12px]">
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.replace('/login')}
          className="w-[58px] h-[22px] rounded-[4px] items-center justify-center bg-[#E5E5EA] mr-[8px]"
        >
          <Text className="text-[10px] leading-[10px] text-[#191F28]">
            로그인
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isLoading}
          onPress={handleSendResetEmail}
          className="w-[90px] h-[22px] rounded-[4px] items-center justify-center bg-[#191F28]"
        >
          <Text className="text-[10px] leading-[10px] text-white">
            {isLoading ? '로딩중' : '메일 발송'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}