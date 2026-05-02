/**
 * @file app/(main)/settings/account/index.tsx
 * @description 계정 설정 화면
 * - 이메일, 비밀번호 재설정, 카카오 SNS 연동, 로그아웃, 회원탈퇴
 *
 * ## 다음 연결 작업
 * - [ ] GET /api/v1/users/me — 이메일, 카카오 연동 여부 조회
 * - [ ] 비밀번호 재설정 → API 연결 또는 이메일 발송 플로우
 * - [ ] 카카오 연동 → Kakao OAuth code 획득 후 POST /api/v1/auth/kakao
 * - [ ] 로그아웃 → authStore 토큰 삭제 + (auth) 라우팅
 * - [ ] 회원탈퇴 → 확인 모달 + 탈퇴 API 연결
 */

import {View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';

// TODO: GET /api/v1/users/me 연결 후 동적으로 교체
const MOCK_EMAIL = 'user@email.com';
const MOCK_KAKAO_LINKED = false;

export default function AccountScreen() {
  const handleLogout = () => {
    // TODO: authStore 토큰 삭제 + (auth) 라우팅
  };

  const handleDeleteAccount = () => {
    // TODO: 확인 모달 + 회원탈퇴 API
  };

  const handleKakaoLink = () => {
    // TODO: Kakao OAuth 플로우 (인가 코드 획득 → POST /api/v1/auth/kakao)
  };

  return (
    <SafeAreaView edges={['top']} style={{flex: 1, backgroundColor: Colors.surface}}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: Colors.surface,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
          <Text style={{fontSize: 22, fontWeight: '400', color: '#CCCCCC'}}>{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 타이틀 */}
      <View style={{paddingHorizontal: 24, paddingBottom: 16}}>
        <Text style={{fontSize: 36, fontWeight: '800', color: Colors.textPrimary}}>
          계정
        </Text>
      </View>

      {/* 콘텐츠 */}
      <View style={{flex: 1}}>
        {/* 세로 장식선 — 설정 메인과 동일 */}
        <View
          style={{
            position: 'absolute',
            left: '70%',
            top: 40,
            bottom: 50,
            width: 0.7,
            backgroundColor: '#000000',
          }}
        />

        {/* 상단 콘텐츠 */}
        <View style={{paddingHorizontal: 24, paddingTop: 28, gap: 32}}>
          {/* 이메일 + 비밀번호 재설정 */}
          <View style={{gap: 12}}>
            <Text style={{fontSize: 13, color: Colors.textSecondary}}>
              E-mail : {MOCK_EMAIL}
            </Text>
            <TouchableOpacity activeOpacity={0.6}>
              <Text style={{fontSize: 15, color: Colors.textPrimary}}>비밀번호 재설정</Text>
            </TouchableOpacity>
          </View>

          {/* SNS 연동 상태 */}
          <View style={{gap: 14}}>
            <Text style={{fontSize: 13, color: Colors.textTertiary}}>SNS 연동 상태</Text>

            {MOCK_KAKAO_LINKED ? (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#FEE500',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{fontSize: 15, fontWeight: '700', color: '#3C1E1E'}}>K</Text>
                </View>
                <Text style={{fontSize: 14, color: Colors.textSecondary}}>카카오 연동됨</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleKakaoLink}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: '#FEE500',
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{fontSize: 14, fontWeight: '700', color: '#3C1E1E'}}>K</Text>
                <Text style={{fontSize: 14, fontWeight: '600', color: '#3C1E1E'}}>
                  카카오 연동하기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 하단 버튼 — 바텀에 고정 */}
        <View style={{position: 'absolute', bottom: 48, left: 24, gap: 16}}>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.6}>
            <Text style={{fontSize: 15, color: Colors.textPrimary}}>로그아웃</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAccount} activeOpacity={0.6}>
            <Text style={{fontSize: 14, color: Colors.textTertiary}}>회원탈퇴</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
