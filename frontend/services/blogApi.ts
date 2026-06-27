/**
 * @file services/blogApi.ts
 * @description 저널(블로그) 목록 API 및 타입 정의
 * GET /api/v1/blogs
 */

import {api} from '@/utils/api';

export type JournalData = {
  id: string;
  date: string;              // 'YYYY-MM-DD'
  title: string;
  summary: string | null;    // 카드 미리보기용 (본문 앞 100자, nullable)
  thumbnail_url: string | null;
  is_published: boolean;
  created_at: string;        // ISO 8601
};

export type BlogsResponse = {
  total: number;
  page: number;
  size: number;
  blogs: JournalData[];
};

type FetchBlogsParams = {
  q?: string;
  date?: string;   // 'YYYY-MM-DD'
  page?: number;
  size?: number;
};

export async function fetchBlogs(params: FetchBlogsParams = {}): Promise<BlogsResponse> {
  const {data} = await api.get<BlogsResponse>('/api/v1/blogs', {params});
  return data;
}
export type WritingStyle = 'info' | 'emotion';

export type GenerateBlogRequest = {
  daily_record_id: string;
  user_note?: string;
  writing_style?: WritingStyle;
};

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
  const {data} = await api.get<BlogGenerationStatus>(
    `/api/v1/blog/${blogId}/status`,
  );
  return data;
}

export async function fetchBlogDetail(blogId: string): Promise<BlogDetail> {
  const {data} = await api.get<BlogDetail>(`/api/v1/blog/${blogId}`);
  return data;
}

export async function waitForBlogGeneration(blogId: string): Promise<BlogDetail> {
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
  photoUrls?: string[];
};

export async function updateBlog(
  blogId: string,
  body: UpdateBlogRequest,
): Promise<BlogDetail> {
  const {data} = await api.put<BlogDetail>(`/api/v1/blog/${blogId}`, body);
  return data;
}