import {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';

import {useThemeColors} from '@/hooks/useThemeColors';
import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_LABEL,
  MONTHLY_LABEL,
} from '@/constants/pricing';
import {PRIVACY_POLICY_URL, TERMS_URL} from '@/constants/legal';
import {type BillingCycle} from '@/services/subscriptionApi';

/** 스토어 가격을 못 받았을 때만 쓴다. 국내 기준이라 해외에선 틀릴 수 있다 */
const FALLBACK_LABELS: Record<BillingCycle, string> = {
  monthly: MONTHLY_LABEL,
  annual: ANNUAL_LABEL,
};

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

/** 심사 지침이 구독 "기간" 명시를 요구한다 */
const PERIOD_LABELS: Record<BillingCycle, string> = {
  monthly: '1개월마다 자동 갱신',
  annual: '1년마다 자동 갱신',
};

/** 줄이지 말 것 — 지침 3.1.2 요구 항목(갱신 주기·해지 시한·청구 시점·관리 경로)이 한 문장씩 들어 있다 */
const AUTO_RENEW_NOTICE =
  '구독은 자동으로 갱신됩니다. 현재 구독 기간이 끝나기 최소 24시간 전에 해지하지 않으면 같은 금액으로 자동 갱신되며, 갱신 요금은 기간이 끝나기 24시간 이내에 Apple 계정으로 청구됩니다. 구독 관리와 해지는 기기의 App Store 계정 설정에서 할 수 있습니다.';

async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('오류', '페이지를 열지 못했어요. 잠시 후 다시 시도해주세요.');
  }
}

type Props = {
  /** 주기를 안 넘기면 서버가 월간으로 만든다 */
  onSubscribe: (billingCycle: BillingCycle) => void;
  onRestore: () => void;
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
    return cycle === 'annual'
      ? `연 ${real} (${ANNUAL_DISCOUNT_PERCENT}% 할인! 💡)`
      : `월 ${real}`;
  };

  return (
    // 고지가 길어 작은 화면에서 링크가 밀린다 — 닿을 수 있어야 한다
    <ScrollView
      className="flex-1 px-6"
      contentContainerStyle={{paddingTop: 20, paddingBottom: 24}}
    >
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
              <View>
                <Text className="text-[15px] text-primary">
                  {labelFor(cycle)}
                </Text>
                <Text className="text-[12px] text-tertiary mt-0.5">
                  {PERIOD_LABELS[cycle]}
                </Text>
              </View>
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

      {/* 심사 필수 — 기기 변경·재설치 때 구독을 되찾는 유일한 경로 */}
      <TouchableOpacity
        activeOpacity={0.6}
        disabled={isPurchasing}
        onPress={onRestore}
        className="items-center py-4"
      >
        <Text className="text-[13px] text-tertiary">구매 복원</Text>
      </TouchableOpacity>

      {/* 지침 3.1.2 필수 항목 — 지우면 리젝된다 */}
      <Text className="text-[11px] leading-[16px] text-tertiary mt-2">
        {AUTO_RENEW_NOTICE}
      </Text>

      <View className="flex-row justify-center items-center gap-x-3 mt-4 mb-2">
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => openLink(TERMS_URL)}
        >
          <Text className="text-[12px] text-secondary underline">이용약관</Text>
        </TouchableOpacity>

        <Text className="text-[12px] text-tertiary">·</Text>

        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => openLink(PRIVACY_POLICY_URL)}
        >
          <Text className="text-[12px] text-secondary underline">
            개인정보처리방침
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
