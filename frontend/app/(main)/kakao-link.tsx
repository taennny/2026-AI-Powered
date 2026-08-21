import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {ActivityIndicator, View} from 'react-native';

/**
 * `roameapp://kakao-link` 폴백 화면.
 *
 * 연동 결과는 원래 `settings/account`가 `openAuthSessionAsync`의 반환값으로
 * 직접 처리한다(로그인과 같은 방식). 다만 OS·플랫폼에 따라 딥링크가 브라우저
 * 세션이 아니라 라우터로 바로 흘러들어올 때가 있고, 그때 이 경로가 없으면
 * "Unmatched route" 화면이 뜬다. 그래서 자리만 만들어 두고 설정 화면으로
 * 되돌린다 — 안내 문구는 여기서 띄우지 않는다(양쪽이 다 뜨면 두 번 뜬다).
 *
 * `(auth)`가 아니라 `(main)`에 둔다. 연동은 이미 로그인한 사람만 하는 일이라,
 * 미인증 상태로 들어오면 `(main)/_layout`이 로그인으로 보내는 게 맞다.
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
