import {Modal, View, Text, TouchableOpacity, Pressable} from 'react-native';
import {router} from 'expo-router';

import {MONTHLY_LABEL} from '@/constants/pricing';

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SubscriptionModal({visible, onClose}: Props) {
  // 모달을 띄운 화면(테마) 위에 구독 화면이 겹치지 않도록 먼저 닫는다
  const goToSubscription = () => {
    onClose();
    router.push('/(main)/settings/subscription');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-center items-center"
        style={{backgroundColor: 'rgba(0,0,0,0.45)'}}
        onPress={onClose}
      >
        <Pressable className="w-[82%] bg-surface px-6 pt-5 pb-7">
          <TouchableOpacity
            onPress={onClose}
            className="absolute top-[14px] right-4 p-[6px]"
          >
            <Text className="text-base text-tertiary">✕</Text>
          </TouchableOpacity>

          <View className="items-center mt-2 mb-3">
            <Text className="text-[26px] font-extrabold text-primary">
              {MONTHLY_LABEL}
            </Text>
          </View>

          <Text className="text-center text-sm text-secondary mb-5">
            아직 로미 구독을 안 하셨어요!
          </Text>

          <View className="bg-btn-bg rounded-2xl py-5 px-5 items-center gap-y-2">
            <Text className="text-[15px] font-bold text-btn-text mb-1">
              구독 혜택
            </Text>
            {BENEFITS.map(benefit => (
              <Text key={benefit} className="text-sm text-btn-text">
                {benefit}
              </Text>
            ))}
          </View>

          <TouchableOpacity
            onPress={goToSubscription}
            activeOpacity={0.85}
            className="bg-teal-accent rounded-[28px] py-[14px] items-center mt-5"
          >
            <Text className="text-[15px] font-bold text-white">
              구독하러 가기
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
