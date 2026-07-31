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

export type UploadedPhoto = {
  photo_url: string;
};

export async function uploadPhoto(imageUri: string): Promise<UploadedPhoto> {
  const formData = new FormData();
  formData.append('photo', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  const {data} = await api.post<UploadedPhoto>(
    '/api/v1/photos/upload',
    formData,
    {headers: {'Content-Type': 'multipart/form-data'}},
  );
  return data;
}