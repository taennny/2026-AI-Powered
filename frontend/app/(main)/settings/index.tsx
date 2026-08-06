import {View, Text, TouchableOpacity, Alert, Linking} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

/** 문의 채널 — 카카오 오픈채팅 */
const SUPPORT_CHAT_URL = 'https://open.kakao.com/o/sCvGYyHi';

const MENU_ITEMS = [
  {label: '계정', route: '/(main)/settings/account'},
  {label: '구독', route: '/(main)/settings/subscription'},
  {label: '테마', route: '/(main)/settings/theme'},
  // 위치 기록 토글이 들어 있다. 사진 모아보기도 여기 붙을 예정
  {label: '기록', route: '/(main)/settings/records'},
] as const;

export default function SettingsScreen() {
  /** 앱 밖으로 나가는 동작이라 먼저 알린다 */
  const handleSupport = () => {
    Alert.alert('문의하기', '카카오 오픈채팅으로 이동할까요?', [
      {text: '취소', style: 'cancel'},
      {
        text: '이동',
        onPress: async () => {
          try {
            await Linking.openURL(SUPPORT_CHAT_URL);
          } catch {
            Alert.alert('오류', '채팅방을 열지 못했어요. 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        <View
          className="absolute top-10 bottom-[50px] w-[0.7px] bg-primary"
          style={{left: '70%'}}
        />

        <View className="pt-14 pl-[40px]">
          <Text className="text-[60px] leading-[64px] font-black text-primary">
            Roa{'\n'}me
          </Text>
        </View>

        <View className="pl-12 pt-11 gap-y-6 mt-2">
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.label}
              onPress={() => router.push(item.route)}
              activeOpacity={0.6}
            >
              <Text className="text-base text-primary">{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="absolute bottom-[88px] left-12 gap-y-5">
          <View className="flex-row items-center gap-x-2">
            <Text className="text-sm text-primary">버전 정보</Text>
            <Text className="text-[13px] text-tertiary">1.0.0</Text>
          </View>
          <TouchableOpacity activeOpacity={0.6}>
            <Text className="text-sm text-primary">개인정보처리방침</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6} onPress={handleSupport}>
            <Text className="text-sm text-primary">문의하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
