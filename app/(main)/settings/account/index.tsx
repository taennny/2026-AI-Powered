/**
 * @file app/(main)/settings/account/index.tsx
 * @description 계정 설정 화면 (이메일, 비밀번호 재설정, 카카오 SNS 연동, 로그아웃, 회원탈퇴)
 *
 * ## 다음 연결 작업
 * - [ ] GET /api/v1/users/me — 이메일, 카카오 연동 여부 동적 처리 (현재 MOCK 상수)
 * - [ ] 카카오 연동 백엔드 URL 확인 — 현재 https://api.roame.com/auth/kakao/link 가정
 * - [ ] 회원탈퇴 → 확인 모달 + 탈퇴 API 연결
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import {useAuthStore} from '@/store/authStore';

// TODO: GET /api/v1/users/me 연결 후 동적으로 교체
const MOCK_EMAIL = 'user@email.com';
const MOCK_KAKAO_LINKED = false;

export default function AccountScreen() {
  const logout = useAuthStore(s => s.logout);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    // TODO: 확인 모달 + 회원탈퇴 API
  };

  const handleKakaoLink = async () => {
    try {
      await WebBrowser.openAuthSessionAsync(
        'https://api.roame.com/auth/kakao/link?source=account-link',
        'roameapp://kakao-login',
      );
    } catch (error) {
      console.log('kakao link error', error);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">

      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">계정</Text>
      </View>

      {/* 콘텐츠 */}
      <View className="flex-1">
        {/* 세로 장식선 */}
        <View
          className="absolute top-10 bottom-[50px] w-[0.7px] bg-primary"
          style={{left: '70%'}}
        />

        {/* 상단 콘텐츠 */}
        <View className="px-6 pt-7 gap-y-8">
          {/* 이메일 + 비밀번호 재설정 */}
          <View className="gap-y-3">
            <Text className="text-[13px] text-secondary">
              E-mail : {MOCK_EMAIL}
            </Text>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => router.push('/(auth)/find-password')}
            >
              <Text className="text-[15px] text-primary">비밀번호 재설정</Text>
            </TouchableOpacity>
          </View>

          {/* SNS 연동 상태 */}
          <View className="gap-y-[14px]">
            <Text className="text-[13px] text-tertiary">SNS 연동 상태</Text>
            {MOCK_KAKAO_LINKED ? (
              <View className="flex-row items-center gap-x-[10px]">
                <View className="w-9 h-9 rounded-full bg-[#FEE500] items-center justify-center">
                  <Text className="text-[15px] font-bold text-[#3C1E1E]">K</Text>
                </View>
                <Text className="text-sm text-secondary">카카오 연동됨</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleKakaoLink}
                activeOpacity={0.8}
                className="flex-row items-center gap-x-[10px] bg-[#FEE500] py-[10px] px-4 rounded-xl self-start"
              >
                <Text className="text-sm font-bold text-[#3C1E1E]">K</Text>
                <Text className="text-sm font-semibold text-[#3C1E1E]">카카오 연동하기</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 하단 버튼 */}
        <View className="absolute bottom-12 left-6 gap-y-4">
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.6}>
            <Text className="text-[15px] text-primary">로그아웃</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.6}>
            <Text className="text-sm text-tertiary">회원탈퇴</Text>
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}
