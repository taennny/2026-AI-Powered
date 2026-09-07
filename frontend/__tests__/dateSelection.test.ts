import {
  canGenerate,
  isSelecting,
  selectedDateKeys,
  useDateSelectionStore,
} from '@/store/dateSelectionStore';
import {buildDateTarget, isContiguous} from '@/services/blogApi';

const reset = () => useDateSelectionStore.getState().clear();
const {toggle} = useDateSelectionStore.getState();
const selected = () => useDateSelectionStore.getState().selected;

describe('dateSelectionStore', () => {
  beforeEach(reset);

  it('고른 게 없으면 선택 모드가 아니다', () => {
    expect(isSelecting(selected())).toBe(false);
  });

  it('하나 고르면 선택 모드가 되고, 다시 누르면 끝난다', () => {
    toggle('2026-08-03', true);
    expect(isSelecting(selected())).toBe(true);

    toggle('2026-08-03', true);
    expect(isSelecting(selected())).toBe(false);
  });

  it('여러 개 중 하나만 해제해도 선택 모드는 유지된다', () => {
    toggle('2026-08-03', true);
    toggle('2026-08-04', true);
    toggle('2026-08-03', true);

    expect(isSelecting(selected())).toBe(true);
    expect(selectedDateKeys(selected())).toEqual(['2026-08-04']);
  });

  it('고른 순서와 무관하게 날짜순으로 돌려준다', () => {
    toggle('2026-08-09', true);
    toggle('2026-08-01', true);
    toggle('2026-08-05', true);

    expect(selectedDateKeys(selected())).toEqual([
      '2026-08-01',
      '2026-08-05',
      '2026-08-09',
    ]);
  });

  it('기록 있는 날이 하나라도 있어야 글을 만들 수 있다', () => {
    toggle('2026-08-03', false);
    expect(canGenerate(selected())).toBe(false);

    toggle('2026-08-04', true);
    expect(canGenerate(selected())).toBe(true);
  });

  it('달을 넘겨 고른 날의 기록 여부도 기억한다', () => {
    // eventDays는 보고 있는 달 것만이라 스토어가 들고 있지 않으면 잃는다
    toggle('2026-08-31', true);
    toggle('2026-09-01', false);

    expect(selected()['2026-08-31']).toBe(true);
    expect(canGenerate(selected())).toBe(true);
  });
});

describe('buildDateTarget', () => {
  it('연속이면 범위로 보낸다 — 현재 서버가 아는 형태다', () => {
    expect(buildDateTarget(['2026-08-03', '2026-08-04', '2026-08-05'])).toEqual(
      {
        start_date: '2026-08-03',
        end_date: '2026-08-05',
      },
    );
  });

  it('하루만 골라도 범위다', () => {
    expect(buildDateTarget(['2026-08-03'])).toEqual({
      start_date: '2026-08-03',
      end_date: '2026-08-03',
    });
  });

  it('중간이 비면 목록으로 보낸다 — 범위로 보내면 안 고른 날이 끼어든다', () => {
    expect(buildDateTarget(['2026-08-03', '2026-08-07'])).toEqual({
      dates: ['2026-08-03', '2026-08-07'],
    });
  });

  it('달을 걸쳐도 이어져 있으면 범위다', () => {
    expect(isContiguous(['2026-08-31', '2026-09-01'])).toBe(true);
  });

  it('월말·월초가 끊겨 있으면 목록이다', () => {
    expect(isContiguous(['2026-08-30', '2026-09-01'])).toBe(false);
  });
});
