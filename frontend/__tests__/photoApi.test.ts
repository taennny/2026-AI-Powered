import {mimeTypeOf, uploadPhoto} from '@/services/photoApi';
import {api} from '@/utils/api';

jest.mock('@/utils/api', () => ({api: {post: jest.fn()}}));

const mockPost = api.post as jest.Mock;

const bodyOf = (call: unknown[]) => call[1] as FormData;

describe('uploadPhoto', () => {
  beforeEach(() => {
    mockPost.mockReset().mockResolvedValue({data: {photo_id: 'p'}});
  });

  // 서버가 `photo: UploadFile = File(...)`로 받는다.
  // 'file'로 보내면 FastAPI가 필수 필드 누락으로 422를 던진다
  it("필드명은 'photo'다", async () => {
    await uploadPhoto('file:///a.jpg', 'a.jpg');

    // 'file'로 보내면 이 값이 null이 되고 서버는 422를 던진다
    expect(bodyOf(mockPost.mock.calls[0]).get('photo')).not.toBeNull();
  });

  // 실제 포맷과 다르게 보내면 서버의 EXIF 파서가 내용을 못 읽어
  // taken_at이 업로드 시각으로 떨어지고 사진이 엉뚱한 장소에 붙는다
  it.each([
    ['IMG_1.HEIC', 'image/heic'],
    ['IMG_2.heif', 'image/heif'],
    ['IMG_3.PNG', 'image/png'],
    ['IMG_4.jpg', 'image/jpeg'],
    ['IMG_5.jpeg', 'image/jpeg'],
    ['이름없음', 'image/jpeg'],
  ])('%s → %s', (fileName, expected) => {
    expect(mimeTypeOf(fileName)).toBe(expected);
  });

  it('기본 타임아웃(15초)보다 길게 잡는다 — 사진은 GPS 배치보다 훨씬 크다', async () => {
    await uploadPhoto('file:///a.jpg', 'a.jpg');

    expect(mockPost.mock.calls[0][2].timeout).toBeGreaterThan(15_000);
  });
});
