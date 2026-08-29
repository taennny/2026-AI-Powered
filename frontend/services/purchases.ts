/**
 * 결제 SDK(RevenueCat). 앱은 영수증을 서버로 보내지 않는다 —
 * SDK가 Apple과 결제하고, RevenueCat이 검증해 백엔드로 웹훅을 보낸다.
 *
 * **SDK의 구독 상태는 판정에 쓰지 않는다.** 개방은 언제나 서버만 본다
 * (어긋날 때 웹훅으로 정산하는 쪽이 맞다) — 그래서 Entitlement를 보지 않는다.
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
 * RevenueCat 대시보드의 **public** 키 (secret은 앱에 넣지 않는다).
 * 없으면 결제 기능만 조용히 꺼진다 — 앱은 그대로 동작해야 하므로 던지지 않는다.
 */
const API_KEY =
  Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  }) ?? '';

/**
 * 백엔드 `revenuecat_webhook.py`의 `PRODUCT_PLAN_MAP`과 **글자 단위로 같아야 한다** —
 * 다르면 결제는 되는데 웹훅이 플랜을 몰라 구독이 안 열린다.
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

/** 사용자 식별 없이 먼저 초기화한다 — 로그인 전에도 가격을 보여줘야 한다 */
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
 * 로그인 직후 한 번. 이 값이 없으면 웹훅이 와도 백엔드가 누구 결제인지 모른다.
 */
export async function identifyUser(): Promise<void> {
  try {
    const me = await fetchMe();
    if (!me.user_id || me.user_id === identifiedUserId) return;
    if (!ensureConfigured()) return;

    await Purchases.logIn(me.user_id);
    identifiedUserId = me.user_id;
  } catch {
    // 다음 로그인·복귀 때 다시 시도된다
  }
}

/** 로그아웃 시 호출 — 다음 사용자의 결제가 이전 계정에 붙으면 안 된다 */
export function resetIdentifiedUser(): void {
  identifiedUserId = null;
  if (!configured) return;

  // 실패해도 로그아웃 자체는 진행돼야 한다
  void Purchases.logOut().catch(() => {});
}

export type PurchaseOption = {
  cycle: BillingCycle;
  /** 지역·환율이 반영된 표시용 가격 문자열 (예: '₩6,500') */
  priceString: string;
  package: PurchasesPackage;
};

/**
 * 실제 판매 가격. Apple이 나라마다 다른 가격표를 써서 표시용 문자열은
 * 반드시 여기서 와야 한다. 실패 시 빈 배열 — 화면이 기본값으로 그린다.
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
 * @returns 'cancelled'는 실패가 아니다 — 다이얼로그를 닫은 것뿐이라 안내하지 않는다.
 *
 * 성공해도 **여기서 구독 상태를 바꾸지 않는다** — 호출부가 서버에 다시 물어본다.
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
 * 구매 복원 — **심사 필수.** 되찾을 경로가 없으면 리젝된다.
 * 복원도 웹훅을 거치므로 호출부는 결제와 똑같이 서버를 재조회한다.
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
