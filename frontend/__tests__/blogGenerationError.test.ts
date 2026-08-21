import {describeBlogGenerationError} from '@/utils/blogGenerationError';

/** axios가 던지는 형태 */
const httpError = (status: number, detail = '무언가') => ({
  response: {status, data: {detail}},
  message: `Request failed with status code ${status}`,
});

/** 백엔드의 429 응답 — detail에 limit/used/reset_at이 담겨 온다 */
const quotaError = (resetAt: unknown) => ({
  response: {
    status: 429,
    data: {
      detail: {
        message: '이번 주 생성 횟수를 모두 사용했습니다',
        limit: 3,
        used: 3,
        reset_at: resetAt,
      },
    },
  },
});

describe('describeBlogGenerationError', () => {
  describe('429 — 주간 생성 횟수 초과', () => {
    // 권한 부족(403)이나 결제 필요(402)가 아니라 할당량 소진이라 429로 합의했다
    it('구독 화면을 안내한다', () => {
      const info = describeBlogGenerationError(httpError(429));

      expect(info.showSubscription).toBe(true);
      expect(info.message).toContain('프리미엄');
    });

    it('reset_at이 오면 언제부터 다시 되는지 알려준다', () => {
      const info = describeBlogGenerationError(
        quotaError('2026-08-10T04:00:00+09:00'),
      );

      expect(info.message).toContain('8월 10일');
    });

    // 없어도 문구만 담백해질 뿐 깨지면 안 된다
    it('reset_at이 없거나 형식이 이상해도 안내는 나간다', () => {
      for (const raw of [undefined, 'not-a-date', 12345]) {
        const info = describeBlogGenerationError(quotaError(raw));

        expect(info.showSubscription).toBe(true);
        expect(info.message).toContain('프리미엄');
      }
    });
  });

  // 429로 합의되기 전 임시로 받아주던 코드들이다
  it.each([402, 403])('%d는 더 이상 횟수 초과로 보지 않는다', status => {
    expect(describeBlogGenerationError(httpError(status)).showSubscription).toBe(
      false,
    );
  });

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

  it('detail이 없어도 상태 코드만으로 판단한다', () => {
    const withoutData = {response: {status: 429}};

    expect(describeBlogGenerationError(withoutData).showSubscription).toBe(
      true,
    );
  });
});
