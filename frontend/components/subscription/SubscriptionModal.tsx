/**
 * @file components/subscription/SubscriptionModal.tsx — 미구독 사용자 구독 유도 팝업
 *
 * ## 다음 연결 작업
 * - [ ] 구독하기 버튼 → 결제 플로우 연결
 */

import {Modal, View, Text, TouchableOpacity, Pressable} from 'react-native';

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SubscriptionModal({visible, onClose}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-center items-center"
        style={{backgroundColor: 'rgba(0,0,0,0.45)'}}
        onPress={onClose}
      >
        <Pressable className="w-[82%] bg-white px-6 pt-5 pb-7">

          {/* 닫기 */}
          <TouchableOpacity onPress={onClose} className="absolute top-[14px] right-4 p-[6px]">
            <Text className="text-base text-tertiary">✕</Text>
          </TouchableOpacity>

          {/* 가격 */}
          <View className="items-center mt-2 mb-3">
            <Text className="text-[26px] font-extrabold text-primary">월 ₩6,500</Text>
          </View>

          {/* 서브 문구 */}
          <Text className="text-center text-sm text-secondary mb-5">
            아직 로미 구독을 안 하셨어요!
          </Text>

          {/* 혜택 박스 */}
          <View className="bg-primary rounded-2xl py-5 px-5 items-center gap-y-2">
            <Text className="text-[15px] font-bold text-white mb-1">구독 혜택</Text>
            {BENEFITS.map(benefit => (
              <Text key={benefit} className="text-sm text-white">{benefit}</Text>
            ))}
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}
