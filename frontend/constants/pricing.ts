/**
 * 구독 가격 — 화면마다 흩어져 있으면 어긋난다.
 *
 * 실제로 구독 모달은 ₩6,500, 구독 화면은 ₩7,500으로 갈라져 있었고
 * 할인율 문구도 어느 쪽과도 맞지 않았다. 값은 여기 한 곳에만 둔다.
 *
 * **인앱결제를 붙이면 이 값은 표시용 기본값이 된다.** 실제 가격은
 * `Purchases.getOfferings()`가 주는 지역·환율 반영 가격을 써야 한다
 * (같은 ₩7,500이 나라마다 다른 금액으로 청구된다).
 */

export const MONTHLY_PRICE = 6_500;
export const ANNUAL_PRICE = 39_000;

/**
 * 연간 결제 시 할인율(%). 손으로 적지 않고 계산한다 —
 * 가격만 고치고 문구를 안 고쳐서 틀린 할인율이 붙어 있던 적이 있다.
 */
export const ANNUAL_DISCOUNT_PERCENT = Math.round(
  (1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100,
);

/** 1234567 → '₩1,234,567' */
export function formatPrice(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}

export const MONTHLY_LABEL = `월 ${formatPrice(MONTHLY_PRICE)}`;
export const ANNUAL_LABEL = `연 ${formatPrice(ANNUAL_PRICE)} (${ANNUAL_DISCOUNT_PERCENT}% 할인! 💡)`;
