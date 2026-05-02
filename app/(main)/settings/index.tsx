/**
 * @file app/(main)/settings/index.tsx
 * @description 설정 화면
 * - 계정 / 구독 / 테마 메뉴
 * - 우측 세로 장식선
 */

import {View, Text, TouchableOpacity, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {Colors} from '@/constants/Colors';

const MENU_ITEMS = [
  {label: '계정', route: '/(main)/settings/account'},
  {label: '구독', route: '/(main)/settings/subscription'},
  {label: '테마', route: '/(main)/settings/theme'},
] as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView
      edges={['top']}
      style={{flex: 1, backgroundColor: Colors.surface}}
    >
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
          <Text style={{fontSize: 22, fontWeight: '400', color: '#CCCCCC'}}>
            {'<'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 */}
      <View style={{flex: 1}}>
        {/* 우측 세로 장식선 */}
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
        <View style={{paddingTop: 40, paddingLeft: 5}}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{height: 78, width: 170}}
            resizeMode="contain"
          />
        </View>
        {/* 메뉴 목록 */}
        <View style={{paddingLeft: 48, paddingTop: 44, gap: 24}}>
          <View style={{gap: 24, marginTop: 8}}>
            {MENU_ITEMS.map(item => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route)}
                activeOpacity={0.6}
              >
                <Text style={{fontSize: 16, color: Colors.textPrimary}}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 하단 보조 메뉴 — 바텀 고정 */}
        <View style={{position: 'absolute', bottom: 88, left: 48, gap: 20}}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text style={{fontSize: 14, color: Colors.textPrimary}}>
              버전 정보
            </Text>
            <Text style={{fontSize: 13, color: Colors.textTertiary}}>
              1.0.0
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.6}>
            <Text style={{fontSize: 14, color: Colors.textPrimary}}>
              개인정보처리방침
            </Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.6}>
            <Text style={{fontSize: 14, color: Colors.textPrimary}}>
              문의하기
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
