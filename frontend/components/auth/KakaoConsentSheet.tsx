/** 카카오 신규 가입자에게 동의를 받는 시트. 흐름은 `useKakaoLogin`이 들고 있다 */

import {ScrollView, Text, TouchableOpacity, View} from 'react-native';

import ConsentList from '@/components/auth/ConsentList';
import BottomActionSheet from '@/components/common/BottomActionSheet';
import {hasAllRequired, type ConsentState} from '@/constants/consent';

type Props = {
  visible: boolean;
  consents: ConsentState;
  onChange: (next: ConsentState) => void;
  onAgree: () => void;
  onCancel: () => void;
};

export default function KakaoConsentSheet({
  visible,
  consents,
  onChange,
  onAgree,
  onCancel,
}: Props) {
  const canAgree = hasAllRequired(consents);

  return (
    <BottomActionSheet
      visible={visible}
      // 배경 탭·안드로이드 뒤로가기도 '동의 안 함'이다 — 토큰만 버리고 로그인 화면에 남는다
      onClose={onCancel}
      title="가입을 마치려면 동의가 필요해요"
      description="처음 오셨네요. 아래 항목을 확인해주세요. 동의하지 않으면 로그인되지 않습니다."
      heightRatio={2 / 3}
    >
      {/* 남는 높이를 다 쓰고, 넘치면 스크롤한다 */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <ConsentList consents={consents} onChange={onChange} />
      </ScrollView>

      <View className="flex-row justify-end mt-4">
        <TouchableOpacity onPress={onCancel} className="px-5 py-3">
          <Text className="text-[13px] text-tertiary">취소</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onAgree}
          disabled={!canAgree}
          className={`ml-1 px-5 py-3 rounded-[8px] ${canAgree ? 'bg-btn-bg' : 'bg-line'}`}
        >
          <Text
            className={`text-[13px] ${canAgree ? 'text-btn-text' : 'text-tertiary'}`}
          >
            동의하고 계속
          </Text>
        </TouchableOpacity>
      </View>
    </BottomActionSheet>
  );
}
