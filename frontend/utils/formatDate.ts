/**
 * @file utils/formatDate.ts
 * @description 날짜 포맷 유틸 함수
 */

/** Date → 'YYYY-MM-DD' (데이터 날짜 키) */
export function toDateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
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
