/**
 * 글 생성 실패를 사용자에게 보여줄 문구로 옮긴다.
 *
 * 전부 "다시 시도해주세요"로 뭉개면, 다시 시도해도 안 되는 실패(횟수 초과·중복 생성)에서
 * 사용자가 같은 벽에 계속 부딪힌다.
 *
 * 상태 코드가 기본이고, 횟수 초과일 때만 body의 `reset_at`을 덧붙여 읽는다.
 * 없거나 형식이 달라도 문구만 담백해질 뿐 깨지지 않는다.
 */

export type BlogGenerationErrorInfo = {
  title: string;
  message: string;
  /** 구독 화면으로 보낼지 — 횟수 초과일 때만 */
  showSubscription: boolean;
};

/** 횟수 초과. 권한 부족(403)이나 결제 필요(402)가 아니라 할당량 소진이라 429다 */
const QUOTA_STATUS = 429;

function statusOf(error: unknown): number | undefined {
  return (error as {response?: {status?: number}})?.response?.status;
}

/**
 * 한도가 풀리는 날짜. 백엔드가 `detail.reset_at`에 ISO 문자열로 준다
 * (주 리셋은 월요일 새벽 4시).
 */
function resetDateOf(error: unknown): string | undefined {
  const detail = (
    error as {response?: {data?: {detail?: {reset_at?: unknown}}}}
  )?.response?.data?.detail;

  if (typeof detail?.reset_at !== 'string') return undefined;

  const date = new Date(detail.reset_at);
  if (Number.isNaN(date.getTime())) return undefined;

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function messageOf(error: unknown): string | undefined {
  return (error as {message?: string})?.message;
}

export function describeBlogGenerationError(
  error: unknown,
): BlogGenerationErrorInfo {
  const status = statusOf(error);

  if (status === QUOTA_STATUS) {
    const resetDate = resetDateOf(error);
    return {
      title: '이번 주 생성 횟수를 다 썼어요',
      // 언제 풀리는지 알려주지 않으면 무료로 계속 쓰려는 사람은
      // 기다려야 할지 결제해야 할지 판단할 수 없다
      message: resetDate
        ? `${resetDate}부터 다시 쓸 수 있어요.\n프리미엄이면 제한 없이 만들 수 있어요.`
        : '프리미엄이면 제한 없이 만들 수 있어요.',
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
