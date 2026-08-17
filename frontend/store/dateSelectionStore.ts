/**
 * 모아쓰기 날짜 선택. 캘린더와 푸터가 떨어져 있어 스토어로 잇는다.
 *
 * 선택 모드 플래그를 따로 두지 않는다 — 고른 게 있으면 선택 모드다.
 * 값의 `has_timeline`을 같이 들고 있는 건 달을 넘기면 `eventDays`가 바뀌어
 * 다시 물어볼 수 없기 때문이다.
 */

import {create} from 'zustand';

type DateSelectionStore = {
  /** 'YYYY-MM-DD' → 그날 타임라인이 있는지 */
  readonly selected: Record<string, boolean>;
  toggle: (dateKey: string, hasTimeline: boolean) => void;
  clear: () => void;
};

export const useDateSelectionStore = create<DateSelectionStore>(set => ({
  selected: {},

  toggle: (dateKey, hasTimeline) =>
    set(state => {
      const next = {...state.selected};
      if (dateKey in next) delete next[dateKey];
      else next[dateKey] = hasTimeline;
      return {selected: next};
    }),

  clear: () => set({selected: {}}),
}));

export function isSelecting(selected: Record<string, boolean>): boolean {
  return Object.keys(selected).length > 0;
}

export function selectedDateKeys(selected: Record<string, boolean>): string[] {
  return Object.keys(selected).sort();
}

/** 전부 빈 날이면 서버가 거절하므로 버튼을 미리 잠근다 */
export function canGenerate(selected: Record<string, boolean>): boolean {
  return Object.values(selected).some(Boolean);
}
