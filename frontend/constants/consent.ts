/**
 * 가입 시 받는 동의 항목.
 *
 * 조 번호가 개인정보처리방침 문서와 짝이라 **문서를 고치면 여기도 같이 본다.**
 * 이메일 가입과 카카오 가입이 같은 목록을 써야 하므로 화면 밖에 둔다 —
 * 두 벌이 되면 한쪽만 고쳐져 조항이 갈린다.
 *
 * `detail`이 있는 항목만 '자세히 보기'를 띄운다. 나이 확인과 선택 동의는
 * 문서에 대응하는 조항이 없다.
 */
export const CONSENT_ITEMS = [
  {id: 'age', required: true, label: '만 14세 이상입니다', detail: false},
  {
    id: 'privacy',
    required: true,
    label: '제1조 개인정보 수집·이용 동의',
    detail: true,
  },
  {
    id: 'location',
    required: true,
    label: '제2조 개인위치정보 백그라운드 상시 수집·이용 동의',
    detail: true,
  },
  {
    id: 'transfer',
    required: true,
    label: '제3조 개인정보 처리위탁 및 국외 이전 동의',
    detail: true,
  },
  {
    id: 'notice',
    required: true,
    label: '제4·5조 안내 사항 확인 (사진 자동 업로드, 베타테스트 특약)',
    detail: true,
  },
  {
    id: 'research',
    required: false,
    label: '서비스 개선 설문·인터뷰 요청 연락 수신',
    detail: false,
  },
] as const;

export type ConsentId = (typeof CONSENT_ITEMS)[number]['id'];

export type ConsentState = Record<ConsentId, boolean>;

export const emptyConsents = (): ConsentState =>
  Object.fromEntries(
    CONSENT_ITEMS.map(item => [item.id, false]),
  ) as ConsentState;

/** 선택 항목은 가입을 막지 않는다 */
export const hasAllRequired = (consents: ConsentState): boolean =>
  CONSENT_ITEMS.filter(item => item.required).every(item => consents[item.id]);

/** 전체 동의는 **선택 항목까지** 켠다 */
export const allConsents = (value: boolean): ConsentState =>
  Object.fromEntries(
    CONSENT_ITEMS.map(item => [item.id, value]),
  ) as ConsentState;

export const isEverythingChecked = (consents: ConsentState): boolean =>
  CONSENT_ITEMS.every(item => consents[item.id]);
