/**
 * 구독 가격 — 화면마다 흩어지면 어긋나므로 여기 한 곳에만 둔다.
 * 인앱결제에서는 표시용 기본값이다. 실제 가격은 `getOfferings()`가 주는
 * 지역·환율 반영 값을 쓴다.
 */

export const MONTHLY_PRICE = 6_500;
export const ANNUAL_PRICE = 39_000;

/** 손으로 적지 않고 계산한다 — 가격만 고치고 문구를 안 고쳐 틀렸던 적이 있다 */
export const ANNUAL_DISCOUNT_PERCENT = Math.round(
  (1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100,
);

/** 1234567 → '₩1,234,567' */
export function formatPrice(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}

export const MONTHLY_LABEL = `월 ${formatPrice(MONTHLY_PRICE)}`;
export const ANNUAL_LABEL = `연 ${formatPrice(ANNUAL_PRICE)} (${ANNUAL_DISCOUNT_PERCENT}% 할인! 💡)`;
