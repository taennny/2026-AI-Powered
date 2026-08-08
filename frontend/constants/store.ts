/**
 * 앱스토어 구독 관리 화면.
 *
 * 인앱결제로 만든 구독의 실체는 앱스토어에 있다. 우리 서버의 구독 행을 지우거나
 * 계정을 삭제해도 결제는 그대로 살아 있어 계속 청구된다 — 해지는 사용자가
 * 여기서 직접 해야 하고, 우리가 대신 해줄 수 없다.
 */
export const APP_STORE_SUBSCRIPTIONS_URL =
  'itms-apps://apps.apple.com/account/subscriptions';
