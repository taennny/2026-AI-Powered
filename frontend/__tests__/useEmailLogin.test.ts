import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {createElement} from 'react';

import {useEmailLogin} from '@/hooks/useEmailLogin';
import {login} from '@/services/authApi';
import {useAuthStore} from '@/store/authStore';

jest.mock('@/services/authApi', () => ({login: jest.fn()}));
jest.mock('expo-router', () => ({router: {replace: jest.fn()}}));

const mockLogin = login as jest.Mock;

function renderHook<T>(hook: () => T) {
  const result = {current: undefined as unknown as T};

  function Probe() {
    result.current = hook();
    return null;
  }

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(createElement(Probe));
  });

  return {result, unmount: () => act(() => renderer.unmount())};
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const unauthorized = () => ({response: {status: 401}});

/** 입력을 채우고 제출한다 */
async function attempt(result: {current: ReturnType<typeof useEmailLogin>}) {
  act(() => result.current.setEmail('a@b.com'));
  act(() => result.current.setPassword('pw'));
  await act(async () => {
    await result.current.submit();
  });
}

describe('useEmailLogin', () => {
  let errors: string[];
  const onError = (message: string) => {
    errors.push(message);
  };

  beforeEach(() => {
    errors = [];
    mockLogin.mockReset().mockResolvedValue({});
    useAuthStore.setState({isAuthenticated: false});
  });

  it('성공하면 인증 플래그를 세운다', async () => {
    const {result} = renderHook(() => useEmailLogin({onError}));
    await attempt(result);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('빈 입력은 요청을 보내지 않는다', async () => {
    const {result} = renderHook(() => useEmailLogin({onError}));
    await act(async () => {
      await result.current.submit();
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(errors).toContain('이메일 또는 비밀번호를 입력해주세요.');
  });

  it('401은 비밀번호가 틀렸다고 알린다', async () => {
    mockLogin.mockRejectedValue(unauthorized());
    const {result} = renderHook(() => useEmailLogin({onError}));
    await attempt(result);

    expect(errors).toContain('이메일 또는 비밀번호가 일치하지 않습니다.');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  // 무차별 대입을 늦추는 장치다. 세는 대상이 401이어야지, 네트워크 오류까지 세면
  // 비행기 모드로 다섯 번 누른 사용자가 잠긴다
  it('401이 5회 쌓이면 더 시도하지 못한다', async () => {
    mockLogin.mockRejectedValue(unauthorized());
    const {result} = renderHook(() => useEmailLogin({onError}));

    for (let i = 0; i < 5; i += 1) await attempt(result);
    expect(mockLogin).toHaveBeenCalledTimes(5);

    await attempt(result);
    expect(mockLogin).toHaveBeenCalledTimes(5);
    expect(errors.at(-1)).toBe('5회 이상 실패하여 로그인이 제한되었습니다.');
  });

  it('네트워크 오류는 실패 횟수에 넣지 않는다', async () => {
    mockLogin.mockRejectedValue(new Error('network'));
    const {result} = renderHook(() => useEmailLogin({onError}));

    for (let i = 0; i < 6; i += 1) await attempt(result);

    expect(mockLogin).toHaveBeenCalledTimes(6);
    expect(errors.at(-1)).toBe('로그인 중 오류가 발생했습니다.');
  });

  it('요청 중에는 isLoading이 켜졌다 꺼진다', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(
      new Promise<void>(resolve => {
        resolveLogin = resolve;
      }),
    );

    const {result} = renderHook(() => useEmailLogin({onError}));
    act(() => result.current.setEmail('a@b.com'));
    act(() => result.current.setPassword('pw'));

    act(() => {
      void result.current.submit();
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveLogin();
      await Promise.resolve();
    });
    expect(result.current.isLoading).toBe(false);
  });
});
