import {create} from 'zustand';

type TimelineStore = {
  totalDistance: number;
  setTotalDistance: (distance: number) => void;
};

export const useTimelineStore = create<TimelineStore>(set => ({
  totalDistance: 0,
  setTotalDistance: distance => set({totalDistance: distance}),
}));
