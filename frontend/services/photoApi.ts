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
 * 실제 포맷과 다르게 보내면 서버의 EXIF 파서가 못 읽어 사진이 엉뚱한 장소에 붙는다.
 * (아이폰 기본 촬영 포맷은 HEIC)
 */
export function mimeTypeOf(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return 'image/jpeg';
  }
}

/**
 * POST /api/v1/photos/upload — 촬영 시각은 못 보낸다(서버가 EXIF로만 판단).
 * 그래서 호출부가 EXIF 없는 사진을 미리 걸러낸다.
 */
export async function uploadPhoto(
  uri: string,
  fileName: string,
): Promise<PhotoUploadResult> {
  const form = new FormData();
  // 필드명 'photo' 고정 — 다르면 FastAPI가 422를 던진다
  form.append('photo', {
    uri,
    name: fileName,
    type: mimeTypeOf(fileName),
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
