import {useState} from 'react';
import {View} from 'react-native';

import BottomSheet from '@/components/bottomsheet/BottomSheet';
import Calendar from '@/components/home/Calendar';
import {useCalendar} from '@/hooks/useCalendar';
import {useDailyAnalyze} from '@/hooks/useDailyAnalyze';

export default function HomeIndex() {
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);
  useDailyAnalyze();
  const {selectedDate, setSelectedDate, viewDate, setViewDate, calendarDays, places} =
    useCalendar();

  const peekHeight =
    containerHeight !== null && calendarHeight !== null
      ? Math.max(0, containerHeight - calendarHeight)
      : null;

  return (
    <View
      className="flex-1 bg-card"
      onLayout={e => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <View onLayout={e => setCalendarHeight(e.nativeEvent.layout.height)}>
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          viewDate={viewDate}
          onViewDateChange={setViewDate}
          eventDays={calendarDays}
        />
      </View>

      {peekHeight !== null && (
        <BottomSheet
          selectedDate={selectedDate}
          peekHeight={peekHeight}
          places={places}
        />
      )}
    </View>
  );
}
