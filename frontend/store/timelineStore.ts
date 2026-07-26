import {create} from 'zustand';

type TimelineStore = {
  placesCount: number;
  setTimeline: (count: number) => void;
  /** analyze 응답으로 받은 오늘의 daily_record id — 글쓰기 요청에 필요 */
  dailyRecordId: string | null;
  setDailyRecordId: (id: string | null) => void;
};

export const useTimelineStore = create<TimelineStore>(set => ({
  placesCount: 0,
  setTimeline: (count) => set({placesCount: count}),
  dailyRecordId: null,
  setDailyRecordId: (id) => set({dailyRecordId: id}),
}));
