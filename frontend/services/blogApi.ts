import {api} from '@/utils/api';

export async function deleteBlog(blogId: string): Promise<void> {
  await api.delete(`/api/v1/blog/${blogId}`);
}

export type JournalData = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  title: string;
  summary: string | null; // 카드 미리보기용 (본문 앞 100자, nullable)
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string; // ISO 8601
};

export type BlogsResponse = {
  total: number;
  page: number;
  size: number;
  blogs: JournalData[];
};

type FetchBlogsParams = {
  q?: string;
  date?: string; // 'YYYY-MM-DD'
  page?: number;
  size?: number;
};

export async function fetchBlogs(
  params: FetchBlogsParams = {},
): Promise<BlogsResponse> {
  const {data} = await api.get<BlogsResponse>('/api/v1/blogs', {params});
  return data;
}
export type WritingStyle = 'info' | 'emotion';

/**
 * 하루 모드는 `daily_record_id`, 모아쓰기는 날짜 지정 — 서버가 둘을 배타로 검증한다.
 * `dates`(불연속)는 백엔드 지원 대기 중이라 연속 선택은 start/end로 보낸다.
 */
export type GenerateBlogRequest = {
  daily_record_id?: string;
  start_date?: string;
  end_date?: string;
  dates?: string[];
  user_note?: string;
  writing_style?: WritingStyle;
};

/** 'YYYY-MM-DD' 오름차순 목록이 하루도 빠짐없이 이어지는지 */
export function isContiguous(dateKeys: string[]): boolean {
  const DAY_MS = 24 * 60 * 60 * 1000;
  for (let i = 1; i < dateKeys.length; i += 1) {
    const prev = new Date(`${dateKeys[i - 1]}T00:00:00Z`).getTime();
    const curr = new Date(`${dateKeys[i]}T00:00:00Z`).getTime();
    if (curr - prev !== DAY_MS) return false;
  }
  return true;
}

/** 고른 날짜들을 서버가 아는 형태로. 연속이면 범위, 아니면 목록 */
export function buildDateTarget(
  dateKeys: string[],
): Pick<GenerateBlogRequest, 'start_date' | 'end_date' | 'dates'> {
  if (isContiguous(dateKeys)) {
    return {start_date: dateKeys[0], end_date: dateKeys[dateKeys.length - 1]};
  }
  return {dates: dateKeys};
}

export type GenerateBlogResponse = {
  blog_id: string;
};

export type BlogGenerationStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed';
};

export type BlogDetail = {
  blog_id: string;
  title: string;
  content: string;
  /** 모아쓰기면 첫 날. 하루짜리는 그 날 */
  target_date: string;
  /**
   * 글에 실제로 포함된 날짜 목록. 하루짜리는 없다.
   * 서버가 기록 없는 날을 빼고 주므로, 고를 때의 목록보다 짧을 수 있다.
   * 연속 구간을 뜻하는 `period_end`도 서버에 있지만, 불연속 모아쓰기에서는
   * 비어 있어 개수를 셀 수 없다 — 표기는 이 배열만 본다.
   */
  dates?: string[] | null;
  created_at: string;
  photo_urls?: string[];
};
export async function generateBlog(
  body: GenerateBlogRequest,
): Promise<GenerateBlogResponse> {
  const {data} = await api.post<GenerateBlogResponse>(
    '/api/v1/blog/generate',
    body,
  );
  return data;
}

export async function fetchBlogGenerationStatus(
  blogId: string,
): Promise<BlogGenerationStatus> {
  // 주의: 상태 조회만 경로가 복수형(blogs)이다. 백엔드 OpenAPI 기준.
  const {data} = await api.get<BlogGenerationStatus>(
    `/api/v1/blogs/${blogId}/status`,
  );
  return data;
}

export async function fetchBlogDetail(blogId: string): Promise<BlogDetail> {
  const {data} = await api.get<BlogDetail>(`/api/v1/blog/${blogId}`);
  return data;
}

export async function waitForBlogGeneration(
  blogId: string,
): Promise<BlogDetail> {
  const maxRetryCount = 15;

  for (let i = 0; i < maxRetryCount; i += 1) {
    const statusResult = await fetchBlogGenerationStatus(blogId);

    if (statusResult.status === 'completed') {
      return fetchBlogDetail(blogId);
    }

    if (statusResult.status === 'failed') {
      throw new Error('BLOG_GENERATION_FAILED');
    }

    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  throw new Error('BLOG_GENERATION_TIMEOUT');
}

export type UpdateBlogRequest = {
  title: string;
  content: string;
};

export async function updateBlog(
  blogId: string,
  body: UpdateBlogRequest,
): Promise<BlogDetail> {
  const {data} = await api.put<BlogDetail>(`/api/v1/blog/${blogId}`, body);
  return data;
}
