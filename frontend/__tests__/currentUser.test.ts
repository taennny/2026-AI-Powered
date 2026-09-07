import {getCurrentUserId} from '@/utils/currentUser';
import {getAccessToken} from '@/utils/tokenStorage';

jest.mock('@/utils/tokenStorage', () => ({getAccessToken: jest.fn()}));

const mockToken = getAccessToken as jest.Mock;

/** 서명은 검증하지 않으므로 payload만 진짜면 된다 */
function makeToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${body}.signature`;
}

describe('getCurrentUserId', () => {
  beforeEach(() => mockToken.mockReset());

  it('액세스 토큰의 sub를 돌려준다', async () => {
    mockToken.mockResolvedValue(
      makeToken({sub: '19446a72-9387-44a8-a924-52da13e2d7b0', type: 'access'}),
    );

    await expect(getCurrentUserId()).resolves.toBe(
      '19446a72-9387-44a8-a924-52da13e2d7b0',
    );
  });

  // 로그아웃 상태 — 업로드도 어차피 못 한다
  it('토큰이 없으면 null', async () => {
    mockToken.mockResolvedValue(null);

    await expect(getCurrentUserId()).resolves.toBeNull();
  });

  it('형식이 깨진 토큰이면 null — 던지지 않는다', async () => {
    for (const bad of ['', 'not-a-jwt', 'a.!!!.c', 'header..signature']) {
      mockToken.mockResolvedValue(bad);
      await expect(getCurrentUserId()).resolves.toBeNull();
    }
  });

  it('sub가 없거나 빈 문자열이면 null', async () => {
    mockToken.mockResolvedValue(makeToken({type: 'access'}));
    await expect(getCurrentUserId()).resolves.toBeNull();

    mockToken.mockResolvedValue(makeToken({sub: ''}));
    await expect(getCurrentUserId()).resolves.toBeNull();
  });

  // 계정을 바꾸면 토큰이 바뀌므로 주인도 따라 바뀐다 — 두 값이 어긋날 수 없다
  it('토큰이 바뀌면 주인도 바뀐다', async () => {
    mockToken.mockResolvedValue(makeToken({sub: 'user-a'}));
    await expect(getCurrentUserId()).resolves.toBe('user-a');

    mockToken.mockResolvedValue(makeToken({sub: 'user-b'}));
    await expect(getCurrentUserId()).resolves.toBe('user-b');
  });
});
