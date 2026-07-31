import {create} from 'zustand';

type TimelineStore = {
  placesCount: number;
  setTimeline: (count: number) => void;
  /** analyze 응답으로 받은 오늘의 daily_record id — 글쓰기 요청에 필요 */
  dailyRecordId: string | null;
  setDailyRecordId: (id: string | null) => void;
  /** 강제 재조회 신호 — 화면 이동 없이 다시 받아야 할 때 증가시킨다 (useCalendar가 구독) */
  refreshKey: number;
  requestRefresh: () => void;
};

export const useTimelineStore = create<TimelineStore>(set => ({
  placesCount: 0,
  setTimeline: (count) => set({placesCount: count}),
  dailyRecordId: null,
  setDailyRecordId: (id) => set({dailyRecordId: id}),
  refreshKey: 0,
  requestRefresh: () => set(s => ({refreshKey: s.refreshKey + 1})),
}));
