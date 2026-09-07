/**
 * 로딩 문구 순서를 만든다 — 진행 안내와 튜토리얼을 번갈아 놓고 마무리를 붙인다.
 *
 * 화면과 떼어 둔 이유는 이게 **순수 함수**라 테스트가 되기 때문이다.
 * `random`을 주입할 수 있어 셔플 결과를 고정한 채로 검증한다.
 */

/**
 * Fisher-Yates. 원본을 건드리지 않는다 — 상수 배열이 호출할 때마다 뒤바뀌면
 * 다음 생성의 순서가 이전 결과에 끌려간다.
 */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 진행 안내는 **순서 그대로**, 튜토리얼은 **섞어서** 하나씩 번갈아 놓는다.
 * 한쪽이 먼저 떨어지면 남은 쪽을 이어 붙인다.
 *
 * @param closing 맨 끝에 한 번. 빈 문자열이면 붙이지 않는다
 * @param random  테스트 주입점. 기본은 `Math.random`
 */
export function buildLoadingSequence(
  progress: readonly string[],
  tips: readonly string[],
  closing = '',
  random: () => number = Math.random,
): string[] {
  const shuffledTips = shuffle(tips, random);
  const sequence: string[] = [];

  const rounds = Math.max(progress.length, shuffledTips.length);
  for (let i = 0; i < rounds; i += 1) {
    if (i < progress.length) sequence.push(progress[i]);
    if (i < shuffledTips.length) sequence.push(shuffledTips[i]);
  }

  if (closing) sequence.push(closing);
  return sequence;
}

/**
 * 문장 끝의 마침표를 원하는 개수의 점으로 바꾼다 — `.` → `..` → `...`.
 *
 * 문장 **중간**의 마침표는 건드리지 않는다
 * ("거의 다 됐어요. 조금만 기다려주세요." 처럼 두 문장인 경우가 있다).
 * 마침표로 끝나지 않는 문구는 그대로 뒤에 붙인다.
 */
export function withDots(message: string, count: number): string {
  const base = message.endsWith('.') ? message.slice(0, -1) : message;
  return base + '.'.repeat(Math.max(count, 0));
}
