import {api} from '@/utils/api';

export type PhotoUploadResult = {
  photo_id: string;
  photo_url: string;
  /** 서버가 EXIF에서 읽은 촬영 시각. EXIF가 없으면 업로드 시각이 들어간다 */
  taken_at: string | null;
  created_at: string;
};

/** 사진 한 장은 GPS 배치보다 훨씬 크다 — 기본 15초로는 모자란다 */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * POST /api/v1/photos/upload
 *
 * 촬영 시각을 함께 보낼 수 없다 — 서버가 파일의 EXIF로만 판단한다.
 * 그래서 EXIF가 없는 사진(스크린샷 등)은 업로드 시각으로 저장돼 엉뚱한 장소에
 * 붙는다. 호출부(`utils/photoSync.ts`)가 그런 사진을 걸러내는 이유다.
 */
export async function uploadPhoto(
  uri: string,
  fileName: string,
): Promise<PhotoUploadResult> {
  const form = new FormData();
  form.append('file', {
    uri,
    name: fileName,
    type: fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
  } as unknown as Blob);

  const {data} = await api.post<PhotoUploadResult>(
    '/api/v1/photos/upload',
    form,
    {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: UPLOAD_TIMEOUT_MS,
    },
  );
  return data;
}
