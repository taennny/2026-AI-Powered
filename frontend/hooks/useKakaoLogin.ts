/**
 * 카카오 로그인과 **신규 가입자 동의**.
 *
 * 카카오로 처음 들어오면 서버가 콜백에서 바로 계정을 만든다 — 회원가입 화면을
 * 안 거치므로 여기서 동의를 받지 않으면 위치 상시 수집 동의 없이 가입이 끝난다.
 *
 * 신규인지는 백엔드가 딥링크에 실어주는 `isNewUser`로 판단한다. 기기에 "동의했음"을
 * 남겨두는 방식이 아니다 — 그러면 재설치한 기존 사용자에게 또 묻고, 같은 기기에서
 * 다른 계정으로 새로 가입하면 안 물어본다.
 */

import {useCallback, useEffect, useState} from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {router, useLocalSearchParams} from 'expo-router';

import {
  buildKakaoAuthUrl,
  KAKAO_APP_REDIRECT,
  KAKAO_REST_API_KEY,
  parseIsNewUser,
} from '@/constants/kakao';
import {emptyConsents, type ConsentState} from '@/constants/consent';
import {useAuthStore} from '@/store/authStore';
import {logError} from '@/utils/logError';
import {removeTokens, saveTokens} from '@/utils/tokenStorage';

type Options = {
  onError: (message: string) => void;
};

export function useKakaoLogin({onError}: Options) {
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);
  // 폴백 딥링크(`(auth)/kakao-login.tsx`)가 신규 가입자를 여기로 보낼 때 붙인다 —
  // 토큰은 이미 저장돼 있고 동의만 남은 상태다
  const {consent} = useLocalSearchParams<{consent?: string}>();

  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [consents, setConsents] = useState<ConsentState>(emptyConsents);

  useEffect(() => {
    if (consent === '1') setIsConsentOpen(true);
  }, [consent]);

  const start = useCallback(async () => {
    if (!KAKAO_REST_API_KEY) {
      onError('카카오 로그인 설정이 없습니다.');
      return;
    }

    try {
      // returnUrl은 앱 딥링크다. 백엔드 콜백을 주면
      // 토큰이 만들어지기 전에 세션이 닫힐 수 있다.
      const result = await WebBrowser.openAuthSessionAsync(
        buildKakaoAuthUrl(),
        KAKAO_APP_REDIRECT,
      );

      if (result.type !== 'success') return;
      if (!result.url) throw new Error('Redirect URL이 없습니다.');

      const {queryParams} = Linking.parse(result.url);
      const accessToken = queryParams?.accessToken;
      const refreshToken = queryParams?.refreshToken;

      if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
        throw new Error('토큰을 받지 못했습니다.');
      }

      // 동의 시트에서 '취소'를 누르면 탈퇴 요청을 보내야 한다 —
      // 그 요청에 토큰이 필요하므로 동의 전에 저장한다.
      await saveTokens(accessToken, refreshToken);

      if (parseIsNewUser(queryParams?.isNewUser)) {
        // 아직 setAuthenticated()를 부르지 않는다 — 인증 플래그가 켜지는 순간
        // (main)이 마운트되면서 위치 권한부터 물어, 동의 시트가 가려진다
        setConsents(emptyConsents());
        setIsConsentOpen(true);
        return;
      }

      setAuthenticated();
      router.replace('/');
    } catch (error) {
      logError('kakao login', error);
      onError('카카오 로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }, [onError, setAuthenticated]);

  const agree = useCallback(() => {
    setIsConsentOpen(false);
    setAuthenticated();
    router.replace('/');
  }, [setAuthenticated]);

  /**
   * 토큰만 버리고 로그인 화면에 남는다.
   *
   * **`deleteAccount()`를 부르지 않는다.** 그건 '가입 취소'가 아니라 회원 탈퇴라,
   * 장소·사진·글·GPS 로그를 전부 하드 삭제한다(`backend/app/services/auth.py`의
   * `withdraw_user`). 사용자에게는 가입 전으로 보이지만 서버에는 이미 계정이 있어서,
   * 시트를 잘못 닫은 것만으로 기존 데이터가 날아갈 수 있다.
   *
   * 대신 **동의하지 않은 계정이 서버에 남는다.** 그 계정으로 다시 들어오면
   * `isNewUser`가 false라 시트가 다시 뜨지 않는다 — 서버가 동의 여부를 상태로
   * 들고 있어야 풀리는 문제다(백엔드에 `has_consented` 요청해 둠).
   */
  const cancel = useCallback(async () => {
    setIsConsentOpen(false);
    await removeTokens();
  }, []);

  return {isConsentOpen, consents, setConsents, start, agree, cancel};
}
