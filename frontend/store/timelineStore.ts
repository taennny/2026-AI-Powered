import {create} from 'zustand';

type TimelineStore = {
  totalDistance: number;
  placesCount: number;
  setTimeline: (distance: number, count: number) => void;
};

export const useTimelineStore = create<TimelineStore>(set => ({
  totalDistance: 0,
  placesCount: 0,
  setTimeline: (distance, count) => set({totalDistance: distance, placesCount: count}),
}));
