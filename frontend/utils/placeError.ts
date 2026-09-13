/**
 * 장소 수정·삭제 실패 → 사용자 문구.
 * 하나로 뭉개면 "이미 지워진 장소"와 "서버가 죽었다"가 같은 문장이 되어,
 * 다시 눌러야 할지 기다려야 할지 알 수 없다.
 */

export type PlaceErrorInfo = {
  title: string;
  message: string;
};

function statusOf(error: unknown): number | undefined {
  return (error as {response?: {status?: number}})?.response?.status;
}

export function describePlaceError(
  error: unknown,
  action: '수정' | '삭제',
): PlaceErrorInfo {
  const status = statusOf(error);

  if (status === undefined) {
    return {
      title: '연결에 실패했어요',
      message: '네트워크를 확인하고 다시 시도해주세요.',
    };
  }

  if (status === 404) {
    return {
      title: '장소를 찾을 수 없어요',
      message:
        '이미 지워졌거나 기록이 갱신됐어요. 새로고침 후 다시 시도해주세요.',
    };
  }

  if (status === 422) {
    return {
      title: `${action}하지 못했어요`,
      message:
        '입력한 값을 서버가 받아들이지 못했어요. 더 짧은 이름으로 시도해주세요.',
    };
  }

  if (status >= 500) {
    return {
      title: '서버 오류',
      message: `잠시 후 다시 시도해주세요. (${status})`,
    };
  }

  return {
    title: `${action}하지 못했어요`,
    message: `다시 시도해주세요. (${status})`,
  };
}
