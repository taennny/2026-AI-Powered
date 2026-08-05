import {describeBlogGenerationError} from '@/utils/blogGenerationError';

/** axios가 던지는 형태 */
const httpError = (status: number, detail = '무언가') => ({
  response: {status, data: {detail}},
  message: `Request failed with status code ${status}`,
});

describe('describeBlogGenerationError', () => {
  it.each([402, 403, 429])(
    '%d는 횟수 초과로 보고 구독 화면을 안내한다',
    status => {
      const info = describeBlogGenerationError(httpError(status));

      expect(info.showSubscription).toBe(true);
      expect(info.message).toContain('프리미엄');
    },
  );

  it('409는 이미 생성 중이라고 알린다 — 구독과 무관하다', () => {
    const info = describeBlogGenerationError(httpError(409));

    expect(info.message).toContain('생성 중인 글');
    expect(info.showSubscription).toBe(false);
  });

  it('404는 기록을 못 찾은 것으로 안내한다', () => {
    expect(describeBlogGenerationError(httpError(404)).message).toContain(
      '기록을 찾을 수 없어요',
    );
  });

  it('폴링 타임아웃은 실패가 아니라 "아직 만드는 중"으로 안내한다', () => {
    const info = describeBlogGenerationError(
      new Error('BLOG_GENERATION_TIMEOUT'),
    );

    expect(info.title).toBe('아직 만들고 있어요');
    expect(info.message).toContain('저널 목록');
  });

  it('생성 실패는 재시도를 안내한다', () => {
    const info = describeBlogGenerationError(
      new Error('BLOG_GENERATION_FAILED'),
    );

    expect(info.title).toBe('생성 실패');
    expect(info.showSubscription).toBe(false);
  });

  it.each([500, 502, 503])('%d는 일반 오류로 처리한다', status => {
    const info = describeBlogGenerationError(httpError(status));

    expect(info.message).toContain('다시 시도');
    expect(info.showSubscription).toBe(false);
  });

  it('응답이 없는 네트워크 오류도 일반 오류로 처리한다', () => {
    const info = describeBlogGenerationError(new Error('Network Error'));

    expect(info.showSubscription).toBe(false);
    expect(info.title).toBe('오류');
  });

  it('예상 못 한 값이 와도 터지지 않는다', () => {
    expect(() => describeBlogGenerationError(undefined)).not.toThrow();
    expect(describeBlogGenerationError(null).showSubscription).toBe(false);
  });

  it('응답 body(detail)에 의존하지 않는다 — 백엔드 형식이 바뀌어도 안전하다', () => {
    const withoutData = {response: {status: 402}};

    expect(describeBlogGenerationError(withoutData).showSubscription).toBe(
      true,
    );
  });
});
