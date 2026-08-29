import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {ActivityIndicator, View} from 'react-native';

/**
 * `roameapp://kakao-link` 폴백 — 연동 결과는 `settings/account`가 직접 처리하고,
 * 딥링크가 라우터로 흘러들어올 때만 여기가 받는다("Unmatched route" 방지).
 * **안내 문구를 띄우지 않는다** — 양쪽이 다 띄우면 두 번 뜬다.
 */
export default function KakaoLinkFallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(main)/settings/account');
  }, [router]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
