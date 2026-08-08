/**
 * 결제 SDK(RevenueCat) 연결 지점.
 *
 * 결제 자체는 SDK가 Apple과 처리하고, 검증 결과는 RevenueCat이 백엔드로
 * 웹훅을 보낸다. 앱은 영수증을 서버로 보내지 않는다.
 *
 *   로그인 → identifyUser(user_id)
 *   결제   → purchase() → SDK가 Apple에 청구 → RevenueCat이 검증 → 백엔드 웹훅
 *   앱     → GET /subscriptions/me 재조회 (웹훅이 몇 초 늦으므로 재시도)
 *
 * **앱은 SDK가 주는 구독 상태를 판정에 쓰지 않는다.** 프리미엄 개방은 언제나
 * 서버(`subscriptionStore.isPremium()`)만 본다 — SDK 캐시와 서버가 어긋날 때
 * 둘 중 하나를 골라야 하는데, 웹훅을 받아 정산하는 쪽이 서버이기 때문이다.
 * 그래서 여기서는 Entitlement를 들여다보지 않는다.
 */

import {Platform} from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';

import {fetchMe} from '@/services/authApi';
import {type BillingCycle} from '@/services/subscriptionApi';

/**
 * 플랫폼별 공개 API 키. RevenueCat 대시보드 > API keys의 **public** 키다
 * (secret 키는 앱에 넣지 않는다). 키가 없으면 결제 기능만 조용히 꺼진다 —
 * 앱 자체는 그대로 동작해야 하므로 여기서 던지지 않는다.
 */
const API_KEY =
  Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  }) ?? '';

/**
 * App Store Connect에 등록한 상품 ID. 백엔드
 * `revenuecat_webhook.py`의 `PRODUCT_PLAN_MAP`과 **글자 단위로 같아야 한다** —
 * 다르면 결제는 되는데 웹훅이 어떤 플랜인지 몰라 구독이 안 열린다.
 */
export const PRODUCT_IDS: Record<BillingCycle, string> = {
  monthly: 'com.picknavi.roame.premium.monthly',
  annual: 'com.picknavi.roame.premium.annual',
};

/** 결제 기능을 쓸 수 있는 상태인지 — 키가 없으면 false */
export function isPurchaseAvailable(): boolean {
  return API_KEY !== '';
}

let configured = false;

/**
 * SDK 초기화. 어떤 결제 호출보다 먼저 한 번만 실행된다.
 *
 * 사용자 식별 없이 먼저 초기화한다 — 로그인 전에도 가격을 보여줄 수 있어야 하고,
 * 식별은 `identifyUser()`가 `logIn`으로 뒤이어 붙인다.
 */
function ensureConfigured(): boolean {
  if (!isPurchaseAvailable()) return false;
  if (configured) return true;

  Purchases.configure({apiKey: API_KEY});
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  configured = true;
  return true;
}

/** 이미 알린 사용자 — 로그인 상태가 유지되는 동안 반복 호출을 막는다 */
let identifiedUserId: string | null = null;

/**
 * 결제 SDK에 "지금 이 사람"을 알린다. 로그인 직후 한 번 부른다.
 *
 * 이 값이 없으면 결제 웹훅이 와도 백엔드가 누구 결제인지 매칭할 수 없다
 * (`revenuecat_webhook.py`가 `app_user_id`를 우리 `users.id`로 파싱한다).
 * user_id는 `GET /auth/me`가 준다.
 */
export async function identifyUser(): Promise<void> {
  try {
    const me = await fetchMe();
    if (!me.user_id || me.user_id === identifiedUserId) return;
    if (!ensureConfigured()) return;

    await Purchases.logIn(me.user_id);
    identifiedUserId = me.user_id;
  } catch {
    // 실패해도 앱 사용에는 지장이 없다. 다음 로그인·복귀 때 다시 시도된다.
    // 결제를 시도하는 시점에 다시 부르므로 여기서 붙잡아둘 이유가 없다.
  }
}

/** 로그아웃 시 호출 — 다음 사용자의 결제가 이전 계정에 붙으면 안 된다 */
export function resetIdentifiedUser(): void {
  identifiedUserId = null;
  if (!configured) return;

  // 익명 사용자로 되돌린다. 실패해도 로그아웃 자체는 진행돼야 한다
  void Purchases.logOut().catch(() => {});
}

export type PurchaseOption = {
  cycle: BillingCycle;
  /** 지역·환율이 반영된 표시용 가격 문자열 (예: '₩6,500') */
  priceString: string;
  package: PurchasesPackage;
};

/**
 * 실제 판매 가격을 가져온다.
 *
 * 하드코딩한 원화 가격은 한국에서만 맞다 — Apple이 나라마다 다른 가격표를
 * 쓰므로 표시용 문자열은 반드시 여기서 와야 한다. 실패하면 빈 배열을 주고,
 * 화면은 `constants/pricing.ts`의 기본값으로 그린다.
 */
export async function getPurchaseOptions(): Promise<PurchaseOption[]> {
  if (!ensureConfigured()) return [];

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];

    return (Object.keys(PRODUCT_IDS) as BillingCycle[])
      .map(cycle => {
        const found = packages.find(
          p => p.product.identifier === PRODUCT_IDS[cycle],
        );
        return found
          ? {cycle, priceString: found.product.priceString, package: found}
          : null;
      })
      .filter((o): o is PurchaseOption => o !== null);
  } catch {
    return [];
  }
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/**
 * 결제를 실행한다.
 *
 * @returns 'cancelled'는 실패가 아니다 — 사용자가 시스템 다이얼로그를 닫은
 *          것이므로 오류 안내를 띄우면 안 된다.
 *
 * 성공해도 **여기서 구독 상태를 바꾸지 않는다.** 호출부가
 * `refreshUntilChanged(false)`로 서버에 물어봐야 한다 — 웹훅이 몇 초 늦다.
 */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!ensureConfigured()) return 'failed';

  try {
    await Purchases.purchasePackage(pkg);
    return 'purchased';
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      return 'cancelled';
    }
    return 'failed';
  }
}

/**
 * 구매 복원 — **Apple 심사 필수 항목이다.** 기기를 바꾸거나 앱을 지웠다
 * 깔았을 때 이미 산 구독을 되찾는 경로가 없으면 리젝된다.
 *
 * 복원도 RevenueCat이 백엔드로 웹훅을 보내므로, 호출부는 결제와 똑같이
 * 서버를 재조회해야 한다.
 */
export async function restorePurchases(): Promise<boolean> {
  if (!ensureConfigured()) return false;

  try {
    await Purchases.restorePurchases();
    return true;
  } catch {
    return false;
  }
}

/** 테스트 전용 */
export function __getIdentifiedUserId(): string | null {
  return identifiedUserId;
}
