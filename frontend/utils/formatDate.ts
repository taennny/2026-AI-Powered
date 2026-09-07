/** 하루의 경계(기기 로컬). 자정이 아니라 새벽 4시 — 회의 결정 */
export const DAY_BOUNDARY_HOUR = 4;

/**
 * 달력 날짜 → 'YYYY-MM-DD'. **이미 "며칠"이 정해진 값에 쓴다.**
 * 경계 보정을 하지 않는다 — 5일을 골랐으면 그냥 5일이다.
 */
export function toDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** ISO 8601 → 'YY.MM.DD(day)' */
export function formatDateFromISO(iso: string): string {
  return formatDate(new Date(iso));
}

/**
 * 순간 → 그 순간이 속한 논리적 하루. **실제 시각에 쓴다**(GPS timestamp 등).
 * 새벽 4시 이전은 전날: 8/6 02:00 → '2026-08-05'.
 */
export function toLogicalDateKey(date: Date): string {
  const shifted = new Date(date.getTime() - DAY_BOUNDARY_HOUR * 60 * 60 * 1000);
  return toDateKey(shifted);
}

/** 논리적 하루의 로컬 자정 — 새벽 2시에 앱을 열면 전날이 선택된다 */
export function logicalToday(): Date {
  const shifted = new Date(Date.now() - DAY_BOUNDARY_HOUR * 60 * 60 * 1000);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

/** Date → 'YY.MM.DD'. 요일까지 필요하면 `formatDate` */
export function formatShortDate(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

/** Date → 'YY.MM.DD(day)' */
export function formatDate(date: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return `${formatShortDate(date)}(${days[date.getDay()]})`;
}

/** 'YYYY-MM-DD' → 'YY.MM.DD(day)' */
export function formatDateStr(dateStr: string): string {
  return formatDate(new Date(dateStr + 'T00:00:00'));
}

/**
 * 그 순간의 '시·분'. `offsetMinutes`를 주면 그 오프셋의 지역 시각으로,
 * 없으면 기기 시간대로 읽는다.
 *
 * `Intl`의 timeZone 옵션을 쓰지 않는 이유는 Hermes 빌드에 따라 조용히
 * 틀린 값을 주기 때문이다. 오프셋만큼 옮겨 UTC 게터로 읽으면 확실하다.
 */
function clockAt(
  iso: string,
  offsetMinutes?: number | null,
): {hour: number; minute: number} {
  const d = new Date(iso);
  if (offsetMinutes === undefined || offsetMinutes === null) {
    return {hour: d.getHours(), minute: d.getMinutes()};
  }
  const shifted = new Date(d.getTime() + offsetMinutes * 60 * 1000);
  return {hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes()};
}

/** ISO 8601 → 그 지역의 '몇 시'(0~23). 타임라인 묶음에 쓴다 */
export function hourFromISO(
  iso: string,
  offsetMinutes?: number | null,
): number {
  return clockAt(iso, offsetMinutes).hour;
}

/** ISO 8601 → '12:00PM' (오프셋을 주면 그 지역 시각, 없으면 기기 기준) */
export function formatTimeFromISO(
  iso: string,
  offsetMinutes?: number | null,
): string {
  const {hour: h, minute: m} = clockAt(iso, offsetMinutes);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, '0')}${period}`;
}

/** ISO 문자열 → '방금' / 'N분 전' / 'N시간 전' / 'N일 전' / 'N달 전' */
export function formatTimeAgo(updatedAt: string): string {
  const diff = Date.now() - new Date(updatedAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  const hours = Math.floor(mins / 60);
  if (hours < 1) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return `${Math.floor(days / 30)}달 전`;
}

/**
 * 위치 기록 날짜 표기 — 모아쓰기는 **첫 날만 적고 나머지는 개수로 줄인다**.
 * 날짜를 다 나열하면 31일까지 가능해서 한 줄을 넘긴다.
 *
 *   하루      → '26.09.05'
 *   모아쓰기  → '26.09.05 외 4일'
 *
 * `dates`는 서버가 준 **실제로 글에 들어간 날짜** 목록이다. 기록이 없는 날은
 * 서버가 빼므로 사용자가 고른 개수보다 적을 수 있다. 첫 날은 `date`와 같으니
 * 나머지는 전체에서 하나 뺀 값이다.
 *
 * 저널 리스트와 미리보기가 같은 문구를 써야 해서 여기 둔다 — 규칙이 갈리면
 * 같은 글이 화면마다 다른 날짜로 보인다.
 *
 * @param date  'YYYY-MM-DD' 또는 ISO 8601. 비었으면 '-'
 */
export function formatRecordDateLabel(
  date: string | undefined,
  dates?: readonly string[] | null,
): string {
  if (!date) return '-';

  const parsed = new Date(date);
  // 형식을 모르면 원본을 그대로 보여준다 — '-'로 뭉개면 원인을 알 수 없다
  const head = Number.isNaN(parsed.getTime()) ? date : formatShortDate(parsed);

  const extraDayCount = Math.max((dates?.length ?? 0) - 1, 0);
  return extraDayCount > 0 ? `${head} 외 ${extraDayCount}일` : head;
}
