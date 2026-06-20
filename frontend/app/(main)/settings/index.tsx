/** @file app/(main)/settings/index.tsx — 설정 메인 화면 (계정 / 구독 / 테마) */

import {View, Text, TouchableOpacity, Image} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

const MENU_ITEMS = [
  {label: '계정', route: '/(main)/settings/account'},
  {label: '구독', route: '/(main)/settings/subscription'},
  {label: '테마', route: '/(main)/settings/theme'},
] as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">

      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 */}
      <View className="flex-1">
        {/* 우측 세로 장식선 */}
        <View
          className="absolute top-10 bottom-[50px] w-[0.7px] bg-primary"
          style={{left: '70%'}}
        />

        <View className="pt-10 pl-[5px]">
          <Image
            source={require('@/assets/images/logo.png')}
            style={{height: 78, width: 170}}
            resizeMode="contain"
          />
        </View>

        {/* 메뉴 목록 */}
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

        {/* 하단 보조 메뉴 */}
        <View className="absolute bottom-[88px] left-12 gap-y-5">
          <View className="flex-row items-center gap-x-2">
            <Text className="text-sm text-primary">버전 정보</Text>
            <Text className="text-[13px] text-tertiary">1.0.0</Text>
          </View>
          <TouchableOpacity activeOpacity={0.6}>
            <Text className="text-sm text-primary">개인정보처리방침</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.6}>
            <Text className="text-sm text-primary">문의하기</Text>
          </TouchableOpacity>
        </View>
      </View>

    </SafeAreaView>
  );
}
