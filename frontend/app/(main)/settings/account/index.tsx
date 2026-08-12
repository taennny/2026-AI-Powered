import {useEffect, useState} from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import {APP_STORE_SUBSCRIPTIONS_URL} from '@/constants/store';
import {KAKAO_LINK_APP_REDIRECT} from '@/constants/kakao';
import {useAuthStore} from '@/store/authStore';
import {
  fetchMe,
  deleteAccount,
  fetchKakaoLinkUrl,
  type UserMe,
} from '@/services/authApi';

export default function AccountScreen() {
  const logout = useAuthStore(s => s.logout);
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    // 구독의 실체는 앱스토어에 있다. 우리 서버 데이터를 지워도 결제는 그대로
    // 살아 있어 탈퇴한 사람에게 계속 청구된다 — 반드시 먼저 알린다.
    //
    // **구독 여부를 따지지 않고 항상 알린다.** 예전에는 isPremium()일 때만
    // 띄웠는데, 구독 조회에 실패하면 스토어가 free로 강등되므로(규칙 2)
    // 비행기 모드처럼 네트워크가 없을 때 진짜 구독자가 경고를 못 보고 탈퇴한다.
    // 탈퇴는 되돌릴 수 없고 계정이 사라지면 앱에서 확인할 방법도 없어서,
    // 무료 사용자가 한 줄 더 읽는 비용보다 놓쳤을 때의 손해가 훨씬 크다.
    Alert.alert(
      '회원탈퇴',
      '정말 탈퇴하시겠습니까?\n탈퇴 시 모든 데이터가 삭제됩니다.\n\n' +
        '구독 중이라면 자동으로 해지되지 않아요. App Store > 구독에서 직접 해지해야 결제가 멈춥니다.',
      [
        {
          text: '구독 관리 열기',
          onPress: () => {
            void Linking.openURL(APP_STORE_SUBSCRIPTIONS_URL);
          },
        },
        {text: '취소', style: 'cancel' as const},
        {
          text: '탈퇴',
          style: 'destructive' as const,
          onPress: async () => {
            try {
              await deleteAccount();
              await logout();
              router.replace('/(auth)/login');
            } catch {
              Alert.alert(
                '오류',
                '탈퇴 처리 중 문제가 발생했어요. 다시 시도해주세요.',
              );
            }
          },
        },
      ],
    );
  };

  const handleKakaoLink = async () => {
    if (linking) return;
    setLinking(true);
    try {
      // 서버가 state 토큰을 심은 카카오 URL을 만들어 준다. 브라우저로 직접
      // 열면 Authorization 헤더가 안 실려 401이라, axios로 받아서 넘긴다.
      const authorizeUrl = await fetchKakaoLinkUrl();

      const result = await WebBrowser.openAuthSessionAsync(
        authorizeUrl,
        KAKAO_LINK_APP_REDIRECT,
      );

      // 사용자가 브라우저를 닫으면 dismiss/cancel — 조용히 넘어간다
      if (result.type !== 'success' || !result.url) return;

      const {queryParams} = Linking.parse(result.url);
      if (queryParams?.success !== 'true') {
        const reason = queryParams?.reason;
        // 백엔드는 실패 사유를 그대로 내려준다. 대부분 그대로 보여줄 수 있는
        // 한글 문구지만 invalid_state만 코드라 우리가 문장으로 바꾼다.
        // (state는 5분 만료라 카카오 로그인이 길어지면 실제로 난다)
        Alert.alert(
          '연동 실패',
          reason === 'invalid_state'
            ? '연동 요청이 만료됐어요. 다시 시도해주세요.'
            : typeof reason === 'string' && reason
              ? reason
              : '카카오 연동에 실패했어요. 다시 시도해주세요.',
        );
        return;
      }

      // 연동 여부는 서버가 판정한다 — 낙관적으로 켜지 않고 다시 물어본다
      setUser(await fetchMe());
      Alert.alert('연동 완료', '카카오 계정이 연동됐어요.');
    } catch (error) {
      console.log('kakao link error', error);
      Alert.alert('오류', '카카오 연동에 실패했어요. 다시 시도해주세요.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">계정</Text>
      </View>

      <View className="flex-1">
        <View
          className="absolute top-10 bottom-[50px] w-[0.7px] bg-primary"
          style={{left: '70%'}}
        />

        <View className="px-6 pt-7 gap-y-8">
          <View className="gap-y-3">
            {loading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-[13px] text-secondary">
                E-mail : {user?.email ?? '-'}
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => router.push('/(auth)/find-password')}
            >
              <Text className="text-[15px] text-primary">비밀번호 재설정</Text>
            </TouchableOpacity>
          </View>

          <View className="gap-y-[14px]">
            <Text className="text-[13px] text-tertiary">SNS 연동 상태</Text>
            {loading ? (
              <ActivityIndicator size="small" />
            ) : user?.is_kakao_linked ? (
              <View className="flex-row items-center gap-x-[10px]">
                <View className="w-9 h-9 rounded-full bg-[#FEE500] items-center justify-center">
                  <Text className="text-[15px] font-bold text-[#3C1E1E]">
                    K
                  </Text>
                </View>
                <Text className="text-sm text-secondary">카카오 연동됨</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleKakaoLink}
                disabled={linking}
                activeOpacity={0.8}
                className="flex-row items-center gap-x-[10px] bg-[#FEE500] py-[10px] px-4 rounded-xl self-start"
              >
                <Text className="text-sm font-bold text-[#3C1E1E]">K</Text>
                <Text className="text-sm font-semibold text-[#3C1E1E]">
                  {linking ? '연동 중…' : '카카오 연동하기'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="absolute bottom-20 left-6 gap-y-2">
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.6}>
            <Text className="text-[15px] text-primary">로그아웃</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.6}>
            <Text className="text-[15px] text-tertiary">회원탈퇴</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
