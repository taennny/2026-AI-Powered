/**
 * 하루의 경계 시각(기기 로컬). 자정이 아니라 새벽 4시다 — 회의 결정.
 * 자정 직후의 활동은 "전날 밤"으로 묶이고, 자정을 걸친 체류가 이틀로 쪼개져
 * 중복 계상되던 문제도 이걸로 사라진다.
 */
export const DAY_BOUNDARY_HOUR = 4;

/**
 * 달력 날짜 → 'YYYY-MM-DD'.
 *
 * **이미 "며칠"이 정해진 값에 쓴다** (캘린더에서 고른 날짜 등).
 * 경계 보정을 하지 않는다 — 사용자가 5일을 골랐으면 그냥 5일이다.
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
 * 순간(instant) → 그 순간이 속한 논리적 하루의 'YYYY-MM-DD'.
 *
 * **실제 시각에 쓴다** (GPS 로그 timestamp, 지금 이 순간 등).
 * 새벽 4시 이전은 전날로 넘긴다: 8/6 02:00 → '2026-08-05'.
 *
 * 기기 로컬 기준이라 `Intl`의 timeZone 지원에 기대지 않는다.
 * 서버가 같은 계산을 할 수 있도록 tz 문자열은 별도로 함께 보낸다(utils/timezone.ts).
 */
export function toLogicalDateKey(date: Date): string {
  const shifted = new Date(date.getTime() - DAY_BOUNDARY_HOUR * 60 * 60 * 1000);
  return toDateKey(shifted);
}

/**
 * 지금이 속한 논리적 하루를 가리키는 Date (그 날짜의 로컬 자정).
 * 캘린더의 "오늘"과 선택 기본값에 쓴다 — 새벽 2시에 앱을 열면 전날이 선택된다.
 */
export function logicalToday(): Date {
  const shifted = new Date(Date.now() - DAY_BOUNDARY_HOUR * 60 * 60 * 1000);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
}

/** Date → 'YY.MM.DD(day)' */
export function formatDate(date: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}(${days[date.getDay()]})`;
}

/** 'YYYY-MM-DD' → 'YY.MM.DD(day)' */
export function formatDateStr(dateStr: string): string {
  return formatDate(new Date(dateStr + 'T00:00:00'));
}

/** ISO 8601 → '12:00PM' 형식 (로컬 시간 기준) */
export function formatTimeFromISO(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
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
