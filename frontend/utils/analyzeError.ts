/**
 * 분석 실패 → 사용자 문구. 하나로 뭉개면 "위치 기록이 없다"와
 * "분석 서버가 죽었다"가 같은 문장이 되어, 뭘 해야 할지 알 수 없다.
 */

export type AnalyzeErrorInfo = {
  title: string;
  message: string;
};

function statusOf(error: unknown): number | undefined {
  return (error as {response?: {status?: number}})?.response?.status;
}

function codeOf(error: unknown): string | undefined {
  return (error as {code?: string})?.code;
}

export function describeAnalyzeError(error: unknown): AnalyzeErrorInfo {
  const status = statusOf(error);

  if (status === 404) {
    return {
      title: '기록이 없어요',
      message: '이 날짜에 저장된 위치 기록이 없어요.',
    };
  }

  // 백엔드가 AI 서버를 못 부른 경우 (자체 상한 30초 초과 포함)
  if (status === 502) {
    return {
      title: '분석 서버 오류',
      message: '분석 서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
    };
  }

  // axios가 요청을 끊었다 — 서버는 계속 처리 중일 수 있다
  if (codeOf(error) === 'ECONNABORTED') {
    return {
      title: '분석이 오래 걸려요',
      message:
        '시간이 오래 걸려 중단했어요. 잠시 후 다시 눌러보면 반영돼 있을 수 있어요.',
    };
  }

  if (status === undefined) {
    return {
      title: '연결 실패',
      message: '네트워크를 확인하고 다시 시도해주세요.',
    };
  }

  return {
    title: '오류',
    message: `기록을 불러오지 못했어요. (${status})`,
  };
}
