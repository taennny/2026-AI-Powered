/**
 * @file components/subscription/FreeView.tsx — 구독 화면 베이직(무료) 사용자 뷰
 *
 * ## 다음 연결 작업
 * - [ ] 로미 프리미엄 시작하기 버튼 → 결제 플로우 연결
 */

import {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';

type BillingCycle = 'monthly' | 'annual';

const PLANS: {id: BillingCycle; label: string}[] = [
  {id: 'monthly', label: '월 ₩7,500'},
  {id: 'annual',  label: '연 ₩39,000 (33% 할인! 💡)'},
];

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

export default function FreeView() {
  const [selected, setSelected] = useState<BillingCycle>('monthly');

  return (
    <View className="flex-1 px-6 pt-5">
      <Text className="text-base font-bold text-primary mb-5">프리미엄 플랜</Text>

      {/* 플랜 선택 */}
      <View className="gap-y-[14px] mb-6">
        {PLANS.map(plan => {
          const isSelected = plan.id === selected;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.7}
              className="flex-row items-center gap-x-[10px]"
            >
              <View
                className="w-[18px] h-[18px] rounded-full items-center justify-center"
                style={{
                  borderWidth: 1.5,
                  borderColor: isSelected ? '#191F28' : '#9ca3af',
                }}
              >
                {isSelected && <View className="w-[10px] h-[10px] rounded-full bg-primary" />}
              </View>
              <Text className="text-[15px] text-primary">{plan.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 구독 혜택 */}
      <View className="bg-teal-bg rounded-2xl py-[18px] px-5 mb-7 gap-y-2">
        <Text className="text-[13px] text-secondary mb-1">구독 혜택</Text>
        {BENEFITS.map(benefit => (
          <Text key={benefit} className="text-[15px] font-semibold text-primary">
            ✓ {benefit}
          </Text>
        ))}
      </View>

      {/* 구독 버튼 */}
      <TouchableOpacity activeOpacity={0.85} className="bg-primary rounded-[28px] py-4 items-center">
        <Text className="text-[15px] font-bold text-white">로미 프리미엄 시작하기</Text>
      </TouchableOpacity>
    </View>
  );
}
