/** 동의 항목 목록. 이메일 가입 화면과 카카오 동의 시트가 같이 쓴다 */

import {Alert, Linking, Text, TouchableOpacity, View} from 'react-native';

import {
  allConsents,
  CONSENT_ITEMS,
  isEverythingChecked,
  type ConsentId,
  type ConsentState,
} from '@/constants/consent';
import {PRIVACY_POLICY_URL} from '@/constants/legal';

type Props = {
  consents: ConsentState;
  onChange: (next: ConsentState) => void;
};

const CHECKBOX =
  'w-[11px] h-[11px] rounded-full border border-[#BDBDBD] items-center justify-center mr-[6px] mt-[2px]';
const CHECKBOX_INNER = 'w-[5px] h-[5px] rounded-full bg-[#BDBDBD]';

async function openPrivacyPolicy() {
  try {
    await Linking.openURL(PRIVACY_POLICY_URL);
  } catch {
    Alert.alert('오류', '페이지를 열지 못했어요. 다시 시도해주세요.');
  }
}

export default function ConsentList({consents, onChange}: Props) {
  const allChecked = isEverythingChecked(consents);

  const toggle = (id: ConsentId) =>
    onChange({...consents, [id]: !consents[id]});

  return (
    <View>
      {/* 전체 동의는 선택 항목까지 켠다. 한 번 더 누르면 전부 해제된다 */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onChange(allConsents(!allChecked))}
        className="flex-row items-center pb-[10px] mb-[10px] border-b border-[#EEEEEE]"
      >
        <View className={`${CHECKBOX} mt-0`}>
          {allChecked ? <View className={CHECKBOX_INNER} /> : null}
        </View>
        <Text className="text-[12px] leading-[16px] font-semibold text-[#3C3C43]">
          전체 동의 (선택 항목 포함)
        </Text>
      </TouchableOpacity>

      {CONSENT_ITEMS.map(item => (
        <TouchableOpacity
          key={item.id}
          activeOpacity={0.8}
          onPress={() => toggle(item.id)}
          className="flex-row items-start mb-[8px]"
        >
          <View className={CHECKBOX}>
            {consents[item.id] ? <View className={CHECKBOX_INNER} /> : null}
          </View>

          <Text className="text-[11px] leading-[15px] text-[#6E6E73] flex-1">
            <Text
              className={item.required ? 'text-[#6E6E73]' : 'text-[#9A9A9A]'}
            >
              {item.required ? '(필수) ' : '(선택) '}
            </Text>
            {item.label}
          </Text>

          {/* 체크와 다른 동작이라 따로 눌리게 한다 — 문서를 보려다 동의가 켜지면 안 된다 */}
          {item.detail ? (
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={openPrivacyPolicy}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
              className="pl-2"
            >
              <Text className="text-[11px] leading-[15px] text-[#9A9A9A] underline">
                자세히 보기
              </Text>
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}
