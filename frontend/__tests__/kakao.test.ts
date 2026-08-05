/**
 * 카카오 OAuth URL 구성.
 *
 * 카카오는 redirect_uri를 등록값과 **문자 단위로** 비교한다. 슬래시 하나만
 * 어긋나도 KOE006으로 막히고, 로그인 화면에 도달조차 못 한다.
 * `.env`는 gitignore라 팀원마다 값이 다르므로 코드에서 정규화한다.
 */

const load = (baseUrl?: string) => {
  let mod!: typeof import('@/constants/kakao');
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
    process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY = 'test-key';
    mod = require('@/constants/kakao');
  });
  return mod;
};

const redirectParam = (authUrl: string) =>
  decodeURIComponent(new URL(authUrl).searchParams.get('redirect_uri') ?? '');

describe('constants/kakao', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterAll(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });

  it('base URL 끝의 슬래시를 떼어낸다 — //api가 되면 카카오가 거부한다', () => {
    const {KAKAO_REDIRECT_URI} = load('https://api.roame.co.kr/');

    expect(KAKAO_REDIRECT_URI).toBe(
      'https://api.roame.co.kr/api/v1/auth/kakao/callback',
    );
  });

  it('슬래시가 여러 개여도 전부 떼어낸다', () => {
    const {KAKAO_REDIRECT_URI} = load('https://api.roame.co.kr///');

    expect(KAKAO_REDIRECT_URI).toBe(
      'https://api.roame.co.kr/api/v1/auth/kakao/callback',
    );
  });

  it('슬래시가 없으면 그대로 둔다', () => {
    const {KAKAO_REDIRECT_URI} = load('https://api.roame.co.kr');

    expect(KAKAO_REDIRECT_URI).toBe(
      'https://api.roame.co.kr/api/v1/auth/kakao/callback',
    );
  });

  it('authorize URL의 redirect_uri도 정규화된 값을 쓴다', () => {
    const {buildKakaoAuthUrl} = load('https://api.roame.co.kr/');

    expect(redirectParam(buildKakaoAuthUrl())).toBe(
      'https://api.roame.co.kr/api/v1/auth/kakao/callback',
    );
  });

  // returnUrl로 백엔드 콜백을 주면 토큰이 만들어지기 전에 세션이 닫힌다
  it('앱 딥링크와 백엔드 콜백은 서로 다른 값이다', () => {
    const {KAKAO_APP_REDIRECT, KAKAO_REDIRECT_URI} = load(
      'https://api.roame.co.kr',
    );

    expect(KAKAO_APP_REDIRECT).toBe('roameapp://kakao-login');
    expect(KAKAO_APP_REDIRECT).not.toBe(KAKAO_REDIRECT_URI);
  });
});
