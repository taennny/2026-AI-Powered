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

  // 같은 경로를 쓰면 kakao-login 화면이 "토큰 없음"으로 보고 로그인으로 튕긴다.
  // 연동은 새 토큰을 만들지 않으므로 연동에 성공하고도 로그아웃된다.
  it('연동 딥링크는 로그인 딥링크와 경로가 갈린다', () => {
    const {KAKAO_APP_REDIRECT, KAKAO_LINK_APP_REDIRECT} = load(
      'https://api.roame.co.kr',
    );

    expect(KAKAO_LINK_APP_REDIRECT).toBe('roameapp://kakao-link');
    expect(KAKAO_LINK_APP_REDIRECT).not.toBe(KAKAO_APP_REDIRECT);
  });
});

/**
 * 신규 가입자에게만 동의 시트를 띄우는 판단이 여기 달려 있다.
 * 백엔드가 파이썬 bool을 f-string에 넣어 보내므로 값이 **대문자 `True`** 다.
 */
describe('parseIsNewUser', () => {
  const {parseIsNewUser} = load('https://api.roame.co.kr');

  it("백엔드가 보내는 대문자 'True'를 신규로 읽는다", () => {
    expect(parseIsNewUser('True')).toBe(true);
  });

  it("소문자 'true'도 신규다 — 백엔드가 표기를 바꿔도 깨지지 않는다", () => {
    expect(parseIsNewUser('true')).toBe(true);
  });

  it("'False'는 기존 사용자다 — 빈 문자열이 아니라고 참으로 읽으면 안 된다", () => {
    expect(parseIsNewUser('False')).toBe(false);
    expect(parseIsNewUser('false')).toBe(false);
  });

  it('파라미터가 아예 없으면 기존 사용자로 본다', () => {
    expect(parseIsNewUser(undefined)).toBe(false);
    expect(parseIsNewUser(null)).toBe(false);
  });

  it('같은 키가 여러 번 와서 배열이 되어도 첫 값으로 판단한다', () => {
    expect(parseIsNewUser(['True'])).toBe(true);
    expect(parseIsNewUser(['False', 'True'])).toBe(false);
  });

  it('예상 못 한 값은 기존 사용자로 본다 — 확신이 없으면 안 띄운다', () => {
    expect(parseIsNewUser('yes')).toBe(false);
    expect(parseIsNewUser(1)).toBe(false);
    expect(parseIsNewUser({})).toBe(false);
  });
});
