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
