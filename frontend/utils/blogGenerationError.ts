/**
 * 글 생성 실패를 사용자에게 보여줄 문구로 옮긴다.
 *
 * 전부 "다시 시도해주세요"로 뭉개면, 다시 시도해도 안 되는 실패(횟수 초과·중복 생성)에서
 * 사용자가 같은 벽에 계속 부딪힌다.
 *
 * 응답 body는 읽지 않고 상태 코드만 본다 — 백엔드가 detail에 뭘 담든 깨지지 않는다.
 */

export type BlogGenerationErrorInfo = {
  title: string;
  message: string;
  /** 구독 화면으로 보낼지 — 횟수 초과일 때만 */
  showSubscription: boolean;
};

/**
 * 횟수 초과 응답 코드. 백엔드와 아직 합의 전이라 셋 다 받아둔다.
 * 확정되면 하나로 좁힐 것. (402가 의미상 가장 맞고, 429는 레이트리밋과 겹침)
 */
const QUOTA_STATUSES = [402, 403, 429];

function statusOf(error: unknown): number | undefined {
  return (error as {response?: {status?: number}})?.response?.status;
}

function messageOf(error: unknown): string | undefined {
  return (error as {message?: string})?.message;
}

export function describeBlogGenerationError(
  error: unknown,
): BlogGenerationErrorInfo {
  const status = statusOf(error);

  if (status !== undefined && QUOTA_STATUSES.includes(status)) {
    return {
      title: '생성 횟수를 다 썼어요',
      message: '프리미엄으로 더 많은 글을 만들 수 있어요.',
      showSubscription: true,
    };
  }

  if (status === 409) {
    return {
      title: '알림',
      message: '이미 생성 중인 글이 있어요. 잠시 후 다시 시도해주세요.',
      showSubscription: false,
    };
  }

  if (status === 404) {
    return {
      title: '오류',
      message: '기록을 찾을 수 없어요. 홈에서 다시 시도해주세요.',
      showSubscription: false,
    };
  }

  // waitForBlogGeneration이 던지는 값 — 폴링 상한을 넘겼을 뿐 생성은 진행 중일 수 있다
  if (messageOf(error) === 'BLOG_GENERATION_TIMEOUT') {
    return {
      title: '아직 만들고 있어요',
      message: '생성이 오래 걸리고 있어요. 잠시 후 저널 목록에서 확인해주세요.',
      showSubscription: false,
    };
  }

  if (messageOf(error) === 'BLOG_GENERATION_FAILED') {
    return {
      title: '생성 실패',
      message: '글을 만들지 못했어요. 다시 시도해주세요.',
      showSubscription: false,
    };
  }

  return {
    title: '오류',
    message: '글 생성에 실패했습니다. 다시 시도해주세요.',
    showSubscription: false,
  };
}
