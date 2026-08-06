/**
 * 결제 SDK(RevenueCat) 연결 지점.
 *
 * 결제 자체는 SDK가 Apple과 처리하고, 검증 결과는 RevenueCat이 백엔드로
 * 웹훅을 보낸다. 앱은 영수증을 서버로 보내지 않는다.
 *
 *   로그인 → identifyUser(user_id)
 *   결제   → SDK가 Apple에 청구 → RevenueCat이 검증 → 백엔드 웹훅
 *   앱     → GET /subscriptions/me 재조회 (웹훅이 몇 초 늦으므로 재시도)
 *
 * **SDK는 아직 설치하지 않았다.** App Store Connect에 인앱결제 상품을
 * 등록해야 상품 목록이 내려오는데, 그건 Apple Developer Program이 있어야
 * 한다. 그때까지 이 파일은 배선만 해두고 실제 호출은 비워둔다 —
 * 계정이 준비되면 아래 TODO 자리에 SDK 호출만 넣으면 된다.
 */

import {fetchMe} from '@/services/authApi';

/** 이미 알린 사용자 — 로그인 상태가 유지되는 동안 반복 호출을 막는다 */
let identifiedUserId: string | null = null;

/**
 * 결제 SDK에 "지금 이 사람"을 알린다. 로그인 직후 한 번 부른다.
 *
 * 이 값이 없으면 결제 웹훅이 와도 백엔드가 누구 결제인지 매칭할 수 없다.
 * user_id는 `GET /auth/me`가 준다.
 */
export async function identifyUser(): Promise<void> {
  try {
    const me = await fetchMe();
    if (!me.user_id || me.user_id === identifiedUserId) return;

    identifiedUserId = me.user_id;

    // TODO(결제): Apple Developer Program 준비되면
    // await Purchases.logIn(me.user_id);
  } catch {
    // 실패해도 앱 사용에는 지장이 없다. 다음 로그인·복귀 때 다시 시도된다.
    // 결제를 시도하는 시점에 다시 부르므로 여기서 붙잡아둘 이유가 없다.
  }
}

/** 로그아웃 시 호출 — 다음 사용자의 결제가 이전 계정에 붙으면 안 된다 */
export function resetIdentifiedUser(): void {
  identifiedUserId = null;

  // TODO(결제): await Purchases.logOut();
}

/** 테스트 전용 */
export function __getIdentifiedUserId(): string | null {
  return identifiedUserId;
}
