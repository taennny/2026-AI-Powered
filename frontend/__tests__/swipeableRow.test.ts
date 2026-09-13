import {shouldOpen} from '@/components/common/SwipeableRow';
import {categoryLeaf} from '@/services/placeApi';

jest.mock('@/utils/api', () => ({api: {}}));

const WIDTH = 144;

describe('shouldOpen', () => {
  it('충분히 밀면 열린다', () => {
    expect(shouldOpen(-100, 0, WIDTH)).toBe(true);
  });

  it('조금만 밀면 제자리로 돌아간다 — 스크롤하다 스친 것까지 열리면 안 된다', () => {
    expect(shouldOpen(-20, 0, WIDTH)).toBe(false);
  });

  // 짧게 튕기는 동작이 흔하다. 거리만 보면 이게 안 열린다
  it('빠르게 튕기면 거리가 짧아도 열린다', () => {
    expect(shouldOpen(-20, -1.2, WIDTH)).toBe(true);
  });

  it('반대로 튕기면 많이 밀었어도 안 열린다', () => {
    expect(shouldOpen(-120, 1.2, WIDTH)).toBe(false);
  });

  it('오른쪽으로 미는 건 여는 동작이 아니다', () => {
    expect(shouldOpen(80, 0, WIDTH)).toBe(false);
  });

  it('버튼이 넓을수록 더 많이 밀어야 한다', () => {
    expect(shouldOpen(-70, 0, WIDTH)).toBe(true);
    expect(shouldOpen(-70, 0, WIDTH * 3)).toBe(false);
  });
});

// 카카오 category_name이 '음식점 > 카페 > 커피전문점' 형태라 목록에 그대로 쓰면 한 줄을 넘긴다
describe('categoryLeaf', () => {
  it('계층 문자열의 마지막 조각만 쓴다', () => {
    expect(categoryLeaf('음식점 > 카페 > 커피전문점')).toBe('커피전문점');
  });

  it('한 단계면 그대로', () => {
    expect(categoryLeaf('카페')).toBe('카페');
  });

  it('없거나 비었으면 null — 표시에서 빠진다', () => {
    expect(categoryLeaf(null)).toBeNull();
    expect(categoryLeaf('')).toBeNull();
    expect(categoryLeaf('   ')).toBeNull();
  });
});
