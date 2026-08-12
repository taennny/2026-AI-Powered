/**
 * 약관·개인정보처리방침 URL.
 *
 * **아직 목(mock) 주소입니다.** 실제 문서를 쓰고 공개 URL(Notion 게시 등)이
 * 나오면 이 두 값만 바꾸면 됩니다 — 화면 코드는 손댈 필요가 없습니다.
 *
 * 이 링크는 편의 기능이 아니라 **앱스토어 심사 요구사항**입니다.
 * App Store 심사 지침 3.1.2는 자동 갱신 구독을 파는 화면의 **앱 안에**
 * 이용약관(EULA)과 개인정보처리방침으로 가는 동작하는 링크를 요구합니다.
 * 링크가 없거나 죽어 있으면 리젝됩니다.
 *
 * 개인정보처리방침에는 위치 상시 수집과 사진 업로드를 반드시 적어야 합니다 —
 * 앱이 실제로 수집하는 것과 문서가 다르면 그것도 리젝 사유입니다.
 */

/** 이용약관(EULA). Apple 표준 EULA를 쓸 거면 아래 APPLE_STANDARD_EULA_URL로 대체 가능 */
export const TERMS_URL = 'https://example.com/roame/terms';

/** 개인정보처리방침 */
export const PRIVACY_POLICY_URL = 'https://example.com/roame/privacy';

/**
 * 자체 EULA를 쓰지 않을 경우 Apple이 제공하는 표준 약관을 대신 링크할 수 있다.
 * 이 경우에도 개인정보처리방침은 반드시 자체 문서여야 한다.
 */
export const APPLE_STANDARD_EULA_URL =
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
