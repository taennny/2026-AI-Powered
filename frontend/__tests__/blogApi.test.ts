import {waitForBlogGeneration} from '@/services/blogApi';
import {api} from '@/utils/api';

jest.mock('@/utils/api', () => ({
  api: {get: jest.fn(), post: jest.fn(), put: jest.fn()},
  UPLOAD_TIMEOUT_MS: 60000,
}));

const mockGet = api.get as jest.Mock;

const status = (s: string) => ({data: {status: s}});
const detail = {data: {blog_id: 'b1', title: '제목', content: '본문'}};

/** 폴링 사이 setTimeout을 흘려보내며 promise가 끝날 때까지 돌린다 */
async function runPolling<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    v => ({ok: true, v}) as const,
    e => ({ok: false, e}) as const,
  );

  for (let i = 0; i < 60; i += 1) {
    await Promise.resolve();
    jest.advanceTimersByTime(2500);
  }

  const result = await settled;
  if (!result.ok) throw result.e;
  return result.v;
}

describe('waitForBlogGeneration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('completed면 곧바로 상세를 받아 반환한다', async () => {
    mockGet
      .mockResolvedValueOnce(status('completed'))
      .mockResolvedValueOnce(detail);

    await expect(runPolling(waitForBlogGeneration('b1'))).resolves.toEqual(
      detail.data,
    );

    expect(mockGet).toHaveBeenNthCalledWith(1, '/api/v1/blogs/b1/status');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/api/v1/blog/b1');
  });

  it('pending·processing 동안 계속 폴링하다가 완료되면 멈춘다', async () => {
    mockGet
      .mockResolvedValueOnce(status('pending'))
      .mockResolvedValueOnce(status('processing'))
      .mockResolvedValueOnce(status('completed'))
      .mockResolvedValueOnce(detail);

    await expect(runPolling(waitForBlogGeneration('b1'))).resolves.toEqual(
      detail.data,
    );

    // status 3번 + detail 1번
    expect(mockGet).toHaveBeenCalledTimes(4);
  });

  it('failed면 더 기다리지 않고 즉시 던진다', async () => {
    mockGet
      .mockResolvedValueOnce(status('processing'))
      .mockResolvedValueOnce(status('failed'));

    await expect(runPolling(waitForBlogGeneration('b1'))).rejects.toThrow(
      'BLOG_GENERATION_FAILED',
    );
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  // 알려진 문제: 15회 × 2.5초 = 37.5초에서 끊긴다.
  // AI 생성이 그보다 오래 걸리면 실제로는 성공했는데 "생성 실패"로 표시된다.
  // 상한을 늘리거나 지수 백오프로 바꿀 때 이 테스트가 같이 바뀌어야 한다.
  it('15회까지 폴링하고 타임아웃을 던진다 (= 약 37.5초)', async () => {
    mockGet.mockResolvedValue(status('processing'));

    await expect(runPolling(waitForBlogGeneration('b1'))).rejects.toThrow(
      'BLOG_GENERATION_TIMEOUT',
    );
    expect(mockGet).toHaveBeenCalledTimes(15);
  });

  it('타임아웃 직전 마지막 시도가 완료되면 성공으로 친다', async () => {
    for (let i = 0; i < 14; i += 1) {
      mockGet.mockResolvedValueOnce(status('processing'));
    }
    mockGet
      .mockResolvedValueOnce(status('completed'))
      .mockResolvedValueOnce(detail);

    await expect(runPolling(waitForBlogGeneration('b1'))).resolves.toEqual(
      detail.data,
    );
  });
});
