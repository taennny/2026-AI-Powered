/**
 * 가격은 화면 세 곳(구독 모달·FreeView·PremiumView)에 나온다.
 * 손으로 적어두면 갈라진다 — 실제로 모달만 ₩6,500이고 나머지는 ₩7,500이었고,
 * 할인율 문구는 어느 쪽과도 맞지 않았다.
 */

import {
  ANNUAL_DISCOUNT_PERCENT,
  ANNUAL_LABEL,
  ANNUAL_PRICE,
  MONTHLY_LABEL,
  MONTHLY_PRICE,
  formatPrice,
} from '@/constants/pricing';

describe('constants/pricing', () => {
  it('세 자리마다 쉼표를 넣는다', () => {
    expect(formatPrice(6500)).toBe('₩6,500');
    expect(formatPrice(39000)).toBe('₩39,000');
  });

  // 문구에 적힌 할인율이 실제 가격과 어긋나면 과장광고가 된다
  it('할인율은 두 가격에서 계산한다', () => {
    const expected = Math.round(
      (1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100,
    );

    expect(ANNUAL_DISCOUNT_PERCENT).toBe(expected);
  });

  it('연간이 월간 12개월보다 싸다', () => {
    expect(ANNUAL_PRICE).toBeLessThan(MONTHLY_PRICE * 12);
    expect(ANNUAL_DISCOUNT_PERCENT).toBeGreaterThan(0);
  });

  it('레이블에 계산된 값이 들어간다', () => {
    expect(MONTHLY_LABEL).toBe(`월 ${formatPrice(MONTHLY_PRICE)}`);
    expect(ANNUAL_LABEL).toContain(formatPrice(ANNUAL_PRICE));
    expect(ANNUAL_LABEL).toContain(`${ANNUAL_DISCOUNT_PERCENT}% 할인`);
  });
});
