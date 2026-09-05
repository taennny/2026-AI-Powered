import {describeAnalyzeError} from '@/utils/analyzeError';

const withStatus = (status: number) => ({response: {status}});

describe('describeAnalyzeError', () => {
  it('404는 위치 기록이 없다는 뜻이다', () => {
    expect(describeAnalyzeError(withStatus(404)).title).toBe('기록이 없어요');
  });

  // 백엔드가 AI 서버를 못 부른 경우. 자체 상한 30초 초과도 여기로 온다
  it('502는 분석 서버 문제로 구분한다', () => {
    expect(describeAnalyzeError(withStatus(502)).title).toBe('분석 서버 오류');
  });

  it('axios 타임아웃은 중단으로 안내한다 — 서버는 계속 처리 중일 수 있다', () => {
    const info = describeAnalyzeError({code: 'ECONNABORTED'});

    expect(info.title).toBe('분석이 오래 걸려요');
    expect(info.message).toContain('다시 눌러보면');
  });

  it('응답이 없으면 네트워크 문제로 본다', () => {
    expect(describeAnalyzeError(new Error('Network Error')).title).toBe(
      '연결 실패',
    );
  });

  // 원인을 못 짚으면 최소한 코드라도 보여준다 — 이게 없으면 매번 추측해야 한다
  it('그 외 상태 코드는 숫자를 문구에 남긴다', () => {
    expect(describeAnalyzeError(withStatus(500)).message).toContain('(500)');
  });
});
