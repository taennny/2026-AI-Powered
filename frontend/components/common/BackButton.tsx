/**
 * @file components/common/BackButton.tsx
 * @description 화면 좌상단 뒤로가기 버튼 (설정 화면의 '<' 스타일 공용화)
 * - 절대 배치 — 부모 컨테이너 좌상단에 고정 (SafeAreaProvider 미사용 환경 대응 고정 오프셋)
 * - 스택 루트(뒤로 갈 화면 없음)에서는 렌더하지 않음
 */

import {Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';

export default function BackButton() {
  const router = useRouter();

  if (!router.canGoBack()) return null;

  return (
    <TouchableOpacity
      onPress={() => router.back()}
      hitSlop={12}
      className="absolute left-3 top-[52px] z-10 p-1"
    >
      <Text className="text-2xl font-normal text-muted">{'<'}</Text>
    </TouchableOpacity>
  );
}
