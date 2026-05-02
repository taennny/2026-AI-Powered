/**
 * @file components/subscription/SubscriptionModal.tsx
 * @description 미구독 사용자에게 보여주는 구독 유도 팝업
 *
 * ## 다음 연결 작업
 * - [ ] 구독하기 버튼 → 결제 플로우 연결
 */

import {Modal, View, Text, TouchableOpacity, Pressable} from 'react-native';

import {Colors} from '@/constants/Colors';

const BENEFITS = ['테마 적용 가능', '광고 안 보기', '글쓰기 무한'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SubscriptionModal({visible, onClose}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 딤 배경 */}
      <Pressable
        style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center'}}
        onPress={onClose}
      >
        {/* 카드 — 내부 탭이 딤 배경으로 전파되지 않도록 */}
        <Pressable
          style={{
            width: '82%',
            backgroundColor: Colors.white,
            borderRadius: 0,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 28,
          }}
        >
          {/* 닫기 버튼 */}
          <TouchableOpacity
            onPress={onClose}
            style={{position: 'absolute', top: 14, right: 16, padding: 6}}
          >
            <Text style={{fontSize: 16, color: Colors.textTertiary}}>✕</Text>
          </TouchableOpacity>

          {/* 가격 */}
          <View style={{alignItems: 'center', marginTop: 8, marginBottom: 12}}>
            <Text style={{fontSize: 26, fontWeight: '800', color: Colors.textPrimary}}>
              월 ₩6,500
            </Text>
          </View>

          {/* 서브 문구 */}
          <Text
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: Colors.textSecondary,
              marginBottom: 20,
            }}
          >
            아직 로미 구독을 안 하셨어요!
          </Text>

          {/* 구독 혜택 박스 */}
          <View
            style={{
              backgroundColor: Colors.textPrimary,
              borderRadius: 16,
              paddingVertical: 20,
              paddingHorizontal: 20,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4}}>
              구독 혜택
            </Text>
            {BENEFITS.map(benefit => (
              <Text key={benefit} style={{fontSize: 14, color: Colors.white}}>
                {benefit}
              </Text>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
