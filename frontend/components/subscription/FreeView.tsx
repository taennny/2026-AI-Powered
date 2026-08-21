import {useState} from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator} from 'react-native';

import {useThemeColors} from '@/hooks/useThemeColors';
import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_LABEL,
  MONTHLY_LABEL,
} from '@/constants/pricing';
import {type BillingCycle} from '@/services/subscriptionApi';

/**
 * 스토어에서 실제 가격을 못 받았을 때 쓰는 문구.
 * 한국 기준이라 해외 사용자에겐 틀릴 수 있다 — 받아오면 그 값이 이긴다.
 */
const FALLBACK_LABELS: Record<BillingCycle, string> = {
  monthly: MONTHLY_LABEL,
  annual: ANNUAL_LABEL,
};

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

type Props = {
  /** 고른 결제 주기를 함께 넘긴다 — 안 넘기면 서버가 무조건 월간으로 만든다 */
  onSubscribe: (billingCycle: BillingCycle) => void;
  onRestore: () => void;
  /** 스토어가 준 실제 가격. 없으면 FALLBACK_LABELS로 그린다 */
  priceLabels?: Partial<Record<BillingCycle, string>>;
  isPurchasing?: boolean;
};

export default function FreeView({
  onSubscribe,
  onRestore,
  priceLabels,
  isPurchasing = false,
}: Props) {
  const [selected, setSelected] = useState<BillingCycle>('monthly');
  const tc = useThemeColors();

  const labelFor = (cycle: BillingCycle) => {
    const real = priceLabels?.[cycle];
    if (!real) return FALLBACK_LABELS[cycle];
    // 할인율은 우리가 정한 값이라 스토어 가격에 붙여준다
    return cycle === 'annual'
      ? `연 ${real} (${ANNUAL_DISCOUNT_PERCENT}% 할인! 💡)`
      : `월 ${real}`;
  };

  return (
    <View className="flex-1 px-6 pt-5">
      <Text className="text-base font-bold text-primary mb-5">
        프리미엄 플랜
      </Text>

      <View className="gap-y-[14px] mb-6">
        {(['monthly', 'annual'] as BillingCycle[]).map(cycle => {
          const isSelected = cycle === selected;
          return (
            <TouchableOpacity
              key={cycle}
              onPress={() => setSelected(cycle)}
              activeOpacity={0.7}
              className="flex-row items-center gap-x-[10px]"
            >
              <View
                className="w-[18px] h-[18px] rounded-full items-center justify-center"
                style={{
                  borderWidth: 1.5,
                  borderColor: isSelected ? tc.primary : tc.tertiary,
                }}
              >
                {isSelected && (
                  <View className="w-[10px] h-[10px] rounded-full bg-primary" />
                )}
              </View>
              <Text className="text-[15px] text-primary">
                {labelFor(cycle)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="bg-teal-bg rounded-2xl py-[18px] px-5 mb-7 gap-y-2">
        <Text className="text-[13px] text-secondary mb-1">구독 혜택</Text>
        {BENEFITS.map(benefit => (
          <Text
            key={benefit}
            className="text-[15px] font-semibold text-primary"
          >
            ✓ {benefit}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={isPurchasing}
        onPress={() => onSubscribe(selected)}
        className="bg-btn-bg rounded-[28px] py-4 items-center"
      >
        {isPurchasing ? (
          <ActivityIndicator size="small" color={tc.btnText} />
        ) : (
          <Text className="text-[15px] font-bold text-btn-text">
            로미 프리미엄 시작하기
          </Text>
        )}
      </TouchableOpacity>

      {/* 기기를 바꾸거나 앱을 지웠다 깔면 이 경로로만 구독을 되찾는다.
          Apple 심사 필수 항목이라 눈에 보이는 곳에 둔다 */}
      <TouchableOpacity
        activeOpacity={0.6}
        disabled={isPurchasing}
        onPress={onRestore}
        className="items-center py-4"
      >
        <Text className="text-[13px] text-tertiary">구매 복원</Text>
      </TouchableOpacity>
    </View>
  );
}
