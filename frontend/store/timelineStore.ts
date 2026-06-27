import {create} from 'zustand';

type TimelineStore = {
  placesCount: number;
  setTimeline: (count: number) => void;
};

export const useTimelineStore = create<TimelineStore>(set => ({
  placesCount: 0,
  setTimeline: (count) => set({placesCount: count}),
}));
