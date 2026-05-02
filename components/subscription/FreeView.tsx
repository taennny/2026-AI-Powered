/**
 * @file components/subscription/FreeView.tsx
 * @description 구독 화면 — 베이직(무료) 사용자 뷰
 *
 * ## 다음 연결 작업
 * - [ ] 로미 프리미엄 시작하기 버튼 → 결제 플로우 연결 (선택된 billing cycle 전달)
 */

import {useState} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';

import {Colors} from '@/constants/Colors';

type BillingCycle = 'monthly' | 'annual';

const PLANS: {id: BillingCycle; label: string}[] = [
  {id: 'monthly', label: '월 ₩7,500'},
  {id: 'annual', label: '연 ₩39,000 (33% 할인! 💡)'},
];

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

export default function FreeView() {
  const [selected, setSelected] = useState<BillingCycle>('monthly');

  return (
    <View style={{flex: 1, paddingHorizontal: 24, paddingTop: 20}}>
      {/* 섹션 타이틀 */}
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: Colors.textPrimary,
          marginBottom: 20,
        }}
      >
        프리미엄 플랜
      </Text>

      {/* 플랜 선택 (활성) */}
      <View style={{gap: 14, marginBottom: 24}}>
        {PLANS.map(plan => {
          const isSelected = plan.id === selected;
          return (
            <TouchableOpacity
              key={plan.id}
              onPress={() => setSelected(plan.id)}
              activeOpacity={0.7}
              style={{flexDirection: 'row', alignItems: 'center', gap: 10}}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  borderWidth: 1.5,
                  borderColor: isSelected
                    ? Colors.textPrimary
                    : Colors.textTertiary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSelected && (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: Colors.textPrimary,
                    }}
                  />
                )}
              </View>
              <Text style={{fontSize: 15, color: Colors.textPrimary}}>
                {plan.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 구독 혜택 박스 */}
      <View
        style={{
          backgroundColor: Colors.tealBg,
          borderRadius: 16,
          paddingVertical: 18,
          paddingHorizontal: 20,
          marginBottom: 28,
          gap: 8,
        }}
      >
        <Text
          style={{fontSize: 13, color: Colors.textSecondary, marginBottom: 4}}
        >
          구독 혜택
        </Text>
        {BENEFITS.map(benefit => (
          <Text
            key={benefit}
            style={{fontSize: 15, fontWeight: '600', color: Colors.textPrimary}}
          >
            ✓ {benefit}
          </Text>
        ))}
      </View>

      {/* 구독 버튼 */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={{
          backgroundColor: Colors.textPrimary,
          borderRadius: 28,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{fontSize: 15, fontWeight: '700', color: Colors.white}}>
          로미 프리미엄 시작하기
        </Text>
      </TouchableOpacity>
    </View>
  );
}
