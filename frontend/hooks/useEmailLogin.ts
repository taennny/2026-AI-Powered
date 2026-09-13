/** 이메일 로그인 — 입력값, 실패 횟수 제한, 상태 코드별 안내 문구 */

import {useCallback, useState} from 'react';
import {router} from 'expo-router';

import {login} from '@/services/authApi';
import {useAuthStore} from '@/store/authStore';

/** 이 횟수를 넘기면 더 시도하지 못한다 */
const MAX_FAIL_COUNT = 5;

const LOCKED_MESSAGE = '5회 이상 실패하여 로그인이 제한되었습니다.';

function messageFor(status: number | undefined): string {
  if (status === 401) return '이메일 또는 비밀번호가 일치하지 않습니다.';
  if (status === 400) return '요청 형식이 올바르지 않습니다.';
  return '로그인 중 오류가 발생했습니다.';
}

type Options = {
  /** 카카오 쪽과 같은 자리에 문구를 띄우므로 화면이 들고 있는 setter를 받는다 */
  onError: (message: string) => void;
};

export function useEmailLogin({onError}: Options) {
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [failCount, setFailCount] = useState(0);

  const submit = useCallback(async () => {
    if (failCount >= MAX_FAIL_COUNT) {
      onError(LOCKED_MESSAGE);
      return;
    }

    if (!email || !password) {
      onError('이메일 또는 비밀번호를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      onError('');

      // login()이 토큰을 디스크에 저장한다 — 여기서는 인증 플래그만 세운다
      await login({email, password});
      setAuthenticated();

      router.replace('/');
    } catch (error) {
      const status = (error as {response?: {status?: number}})?.response
        ?.status;

      if (status === 401) {
        const next = failCount + 1;
        setFailCount(next);
        onError(next >= MAX_FAIL_COUNT ? LOCKED_MESSAGE : messageFor(status));
        return;
      }

      onError(messageFor(status));
    } finally {
      setIsLoading(false);
    }
  }, [email, password, failCount, onError, setAuthenticated]);

  return {email, setEmail, password, setPassword, isLoading, submit};
}
