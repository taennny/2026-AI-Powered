import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

import {subscribePremium, cancelSubscription} from '@/services/subscriptionApi';
import {useSubscriptionStore} from '@/store/subscriptionStore';
import PremiumView from '@/components/subscription/PremiumView';
import FreeView from '@/components/subscription/FreeView';

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function SubscriptionScreen() {
  // 갱신 시점은 useSubscriptionSync가 관리한다 — 여기서는 결제·해지 직후만 부른다
  const subscription = useSubscriptionStore();
  const loading = !subscription.hasLoaded;
  const isPremium = subscription.isPremium();

  const handleSubscribe = () => {
    Alert.alert('프리미엄 구독', '로미 프리미엄을 시작할까요?', [
      {text: '취소', style: 'cancel'},
      {
        text: '확인',
        onPress: async () => {
          try {
            // 서버 응답을 받고 나서 상태를 갱신한다 — 먼저 화면을 바꾸면
            // 결제가 실패했을 때 유료 기능이 잠깐 열린다
            await subscribePremium();
            await useSubscriptionStore.getState().refresh();
            Alert.alert('', '결제가 완료되었습니다.');
          } catch {
            Alert.alert(
              '오류',
              '구독 처리 중 문제가 발생했어요. 다시 시도해주세요.',
            );
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('구독 해지', '정말 로미 프리미엄을 해지하겠어요?', [
      {text: '취소', style: 'cancel'},
      {
        text: '해지',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelSubscription();
            // refresh()가 프리미엄 테마 복귀까지 처리한다
            await useSubscriptionStore.getState().refresh();
            Alert.alert('', '구독이 해지되었습니다.');
          } catch {
            Alert.alert(
              '오류',
              '구독 해지 중 문제가 발생했어요. 다시 시도해주세요.',
            );
          }
        },
      },
    ]);
  };

  const subtitle = !isPremium
    ? '베이직 플랜을 이용 중'
    : subscription.expiresAt
      ? `프리미엄 플랜을 이용 중 - 다음 결제일 : ${formatMonthDay(subscription.expiresAt)}`
      : '프리미엄 플랜을 이용 중';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Text className="text-2xl font-normal text-muted">{'<'}</Text>
        </TouchableOpacity>
      </View>

      <View className="px-6 pb-4">
        <Text className="text-[36px] font-extrabold text-primary">구독</Text>
        {!loading && (
          <Text className="text-[13px] text-secondary mt-1">{subtitle}</Text>
        )}
      </View>

      <View className="h-px bg-line" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" />
        </View>
      ) : isPremium ? (
        <PremiumView
          subscription={{
            plan: subscription.plan,
            is_active: subscription.isActive,
            started_at: subscription.startedAt,
            expires_at: subscription.expiresAt,
          }}
          onCancel={handleCancel}
        />
      ) : (
        <FreeView onSubscribe={handleSubscribe} />
      )}
    </SafeAreaView>
  );
}
