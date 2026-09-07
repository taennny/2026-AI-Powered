import {
  CLOSING_MESSAGE,
  PROGRESS_MESSAGES,
  TIP_MESSAGES,
} from '@/constants/loadingMessages';
import {buildLoadingSequence, withDots} from '@/utils/loadingSequence';

/** 셔플을 고정한다 — 0을 주면 Fisher-Yates가 원본 순서를 크게 흔들지 않는다 */
const noShuffle = () => 0;

describe('buildLoadingSequence', () => {
  it('진행 안내와 튜토리얼을 번갈아 놓고 마무리를 붙인다', () => {
    const result = buildLoadingSequence(
      ['진행1', '진행2'],
      ['팁A', '팁B'],
      '마무리',
      noShuffle,
    );

    expect(result).toEqual([
      '진행1',
      expect.stringMatching(/^팁/),
      '진행2',
      expect.stringMatching(/^팁/),
      '마무리',
    ]);
  });

  // 순서가 뒤집히면 "다듬는 중" 다음에 "살펴보는 중"이 나와 거꾸로 간 것처럼 보인다
  it('진행 안내는 섞지 않는다', () => {
    const progress = ['진행1', '진행2', '진행3'];

    const result = buildLoadingSequence(progress, ['팁A'], '', () => 0.99);

    expect(result.filter(m => m.startsWith('진행'))).toEqual(progress);
  });

  it('튜토리얼은 하나도 빠뜨리지 않는다', () => {
    const tips = ['팁A', '팁B', '팁C'];

    const result = buildLoadingSequence(['진행1'], tips, '', () => 0.5);

    expect(result.filter(m => m.startsWith('팁')).sort()).toEqual(tips);
  });

  // 매번 새로 섞는데 원본을 건드리면 다음 생성 순서가 이전 결과에 끌려간다
  it('원본 배열을 바꾸지 않는다', () => {
    const tips = ['팁A', '팁B', '팁C'];
    const snapshot = [...tips];

    buildLoadingSequence(['진행1'], tips, '', () => 0.9);

    expect(tips).toEqual(snapshot);
  });

  it('마무리는 언제나 맨 끝에 한 번만', () => {
    const result = buildLoadingSequence(
      ['진행1', '진행2', '진행3'],
      ['팁A'],
      '마무리',
      noShuffle,
    );

    expect(result[result.length - 1]).toBe('마무리');
    expect(result.filter(m => m === '마무리')).toHaveLength(1);
  });

  it('마무리가 빈 문자열이면 붙이지 않는다', () => {
    const result = buildLoadingSequence(['진행1'], ['팁A'], '', noShuffle);

    expect(result).toEqual(['진행1', '팁A']);
  });

  // 한쪽이 먼저 떨어져도 남은 문구가 잘리면 안 된다
  it('개수가 달라도 남은 쪽을 이어 붙인다', () => {
    const result = buildLoadingSequence(
      ['진행1'],
      ['팁A', '팁B', '팁C'],
      '',
      noShuffle,
    );

    expect(result).toHaveLength(4);
    expect(result[0]).toBe('진행1');
  });

  describe('실제 문구', () => {
    it('첫 문구는 진행 안내, 마지막은 마무리다', () => {
      const result = buildLoadingSequence(
        PROGRESS_MESSAGES,
        TIP_MESSAGES,
        CLOSING_MESSAGE,
      );

      expect(result[0]).toBe(PROGRESS_MESSAGES[0]);
      expect(result[result.length - 1]).toBe(CLOSING_MESSAGE);
    });

    it('중복 문구가 없다', () => {
      const result = buildLoadingSequence(
        PROGRESS_MESSAGES,
        TIP_MESSAGES,
        CLOSING_MESSAGE,
      );

      expect(new Set(result).size).toBe(result.length);
    });
  });
});

describe('withDots', () => {
  it('끝의 마침표를 점 개수만큼으로 바꾼다', () => {
    expect(withDots('적고 있어요.', 1)).toBe('적고 있어요.');
    expect(withDots('적고 있어요.', 2)).toBe('적고 있어요..');
    expect(withDots('적고 있어요.', 3)).toBe('적고 있어요...');
  });

  // "거의 다 됐어요. 조금만 기다려주세요." 처럼 두 문장인 문구가 있다
  it('문장 중간의 마침표는 건드리지 않는다', () => {
    expect(withDots('거의 다 됐어요. 기다려주세요.', 3)).toBe(
      '거의 다 됐어요. 기다려주세요...',
    );
  });

  it('마침표로 끝나지 않으면 그냥 뒤에 붙인다', () => {
    expect(withDots('불러오는 중', 2)).toBe('불러오는 중..');
  });

  it('물음표로 끝나는 문구를 잘라먹지 않는다', () => {
    expect(withDots('알고 계셨나요?', 2)).toBe('알고 계셨나요?..');
  });
});
