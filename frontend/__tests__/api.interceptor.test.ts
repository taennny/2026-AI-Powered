/**
 * 401 재발급 인터셉터 검증 — "동시에 401이 여러 개 났을 때" 큐가 반드시 풀리는지.
 *
 * 큐에 들어간 요청은 `new Promise`로 호출부에 매달려 있다. resolve도 reject도
 * 되지 않으면 그 요청은 영원히 끝나지 않고, 화면은 무한 로딩이 된다
 * (axios 타임아웃은 이미 응답을 받은 뒤라 걸리지 않는다).
 */

const mockClearAuth = jest.fn();
const mockGetRefreshToken = jest.fn();

jest.mock('@/utils/tokenStorage', () => ({
  getAccessToken: jest.fn(async () => 'expired-access'),
  getRefreshToken: () => mockGetRefreshToken(),
  saveAccessToken: jest.fn(async () => {}),
  removeTokens: jest.fn(async () => {}),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: {getState: () => ({clearAuth: mockClearAuth})},
}));

import axios from 'axios';

import {api} from '@/utils/api';

/** 항상 401을 돌려주는 어댑터 — 서버가 토큰을 거부하는 상황 */
function reject401(config: object) {
  return Promise.reject(
    Object.assign(new Error('Unauthorized'), {
      config,
      response: {status: 401, data: {}},
      isAxiosError: true,
    }),
  );
}

/** 매달린 프로미스를 구분하기 위한 감시자 — 끝나면 settled가 true가 된다 */
function watch<T>(promise: Promise<T>) {
  const state = {settled: false};
  promise.then(
    () => {
      state.settled = true;
    },
    () => {
      state.settled = true;
    },
  );
  return state;
}

const flush = () => new Promise(r => setTimeout(r, 50));

describe('api 401 인터셉터 — 큐가 반드시 풀리는가', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.defaults.adapter = reject401 as never;
  });

  it('리프레시 토큰이 없을 때, 뒤따라온 요청도 끝나야 한다', async () => {
    // 리프레시 토큰이 사라진 상태(로그아웃·만료·회원탈퇴 후 남은 요청).
    // 디스크 읽기라 즉시 끝나지 않는다 — 그 사이 두 번째 요청이 큐에 들어간다
    mockGetRefreshToken.mockImplementation(
      () => new Promise(r => setTimeout(() => r(null), 30)),
    );

    const first = watch(api.get('/api/v1/first').catch(() => {}));

    // 첫 요청이 재발급에 들어간 뒤에 두 번째 요청이 401을 받는다
    await new Promise(r => setTimeout(r, 10));
    const second = watch(api.get('/api/v1/second').catch(() => {}));

    await flush();

    expect(first.settled).toBe(true);
    // 이게 false면 두 번째 요청은 영원히 매달린다
    expect(second.settled).toBe(true);
  });

  it('재발급 응답에 토큰이 비어 있어도 뒤따라온 요청이 끝나야 한다', async () => {
    mockGetRefreshToken.mockImplementation(
      () => new Promise(r => setTimeout(() => r('refresh-1'), 30)),
    );

    // 재발급은 200인데 access_token이 빈 문자열 — 저장은 성공하고
    // processQueue(null, '')가 불린다. '' 는 falsy라 큐가 아무것도 안 한다
    axios.defaults.adapter = (async () => ({
      data: {access_token: ''},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })) as never;

    const first = watch(api.get('/api/v1/first').catch(() => {}));
    await new Promise(r => setTimeout(r, 10));
    const second = watch(api.get('/api/v1/second').catch(() => {}));

    await flush();

    expect(first.settled).toBe(true);
    expect(second.settled).toBe(true);
  });
});
