/**
 * 오류를 통째로 찍지 않는다 — 카카오 콜백은 URL 쿼리에 토큰을 담고 오는데,
 * 그 구간에서 난 오류를 그대로 출력하면 토큰이 기기 로그에 남는다.
 * 릴리스 빌드에도 console 출력은 그대로 들어가고, iOS 기기 로그는 밖에서 읽을 수 있다.
 */
export function logError(label: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.warn(`${label}: ${message}`);
}
