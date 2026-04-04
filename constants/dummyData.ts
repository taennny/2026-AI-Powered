/**
 * @file constants/dummyData.ts
 * @description 개발용 더미 데이터
 *
 * ## 다음 연결 작업
 * - [ ] 실제 API 응답 데이터로 교체
 * - [ ] date 필드 기반으로 서버에서 날짜별 조회
 */

export type PostCardData = {
  id: string;
  /** 'YYYY-MM-DD' 형식 */
  date: string;
  emoji: string;
  /** 'HH:MM' 24시간 형식 */
  startTime: string;
  /** 'HH:MM' 24시간 형식 */
  endTime: string;
  placeName: string;
  category: string;
  latitude: number;
  longitude: number;
};

export const DUMMY_POSTS: PostCardData[] = [
  {
    id: '1',
    date: '2026-04-01',
    emoji: '🌅',
    startTime: '07:30',
    endTime: '08:00',
    placeName: '한강 공원',
    category: 'park',
    latitude: 37.5283,
    longitude: 126.9709,
  },
  {
    id: '2',
    date: '2026-04-01',
    emoji: '🍳',
    startTime: '08:30',
    endTime: '09:00',
    placeName: '홈 카페',
    category: 'home',
    latitude: 37.4449,
    longitude: 126.9994,
  },
  {
    id: '3',
    date: '2026-04-01',
    emoji: '🚇',
    startTime: '09:10',
    endTime: '09:45',
    placeName: '지하철 2호선',
    category: 'transport',
    latitude: 37.4979,
    longitude: 127.0276,
  },
  {
    id: '4',
    date: '2026-04-01',
    emoji: '📚',
    startTime: '10:00',
    endTime: '12:00',
    placeName: '경기대학교 도서관',
    category: 'study',
    latitude: 37.2996,
    longitude: 127.0393,
  },
  {
    id: '5',
    date: '2026-04-01',
    emoji: '☕',
    startTime: '12:00',
    endTime: '13:00',
    placeName: '오르카 카페',
    category: 'cafe',
    latitude: 37.3015,
    longitude: 127.0368,
  },
  {
    id: '6',
    date: '2026-04-01',
    emoji: '🍜',
    startTime: '13:00',
    endTime: '13:40',
    placeName: '수원 국밥 골목',
    category: 'restaurant',
    latitude: 37.2636,
    longitude: 127.0286,
  },
  {
    id: '7',
    date: '2026-04-01',
    emoji: '🏫',
    startTime: '14:00',
    endTime: '18:00',
    placeName: '경기대학교',
    category: 'university',
    latitude: 37.2993,
    longitude: 127.0388,
  },
  {
    id: '8',
    date: '2026-04-01',
    emoji: '🛒',
    startTime: '18:30',
    endTime: '19:00',
    placeName: '이마트 수원점',
    category: 'shopping',
    latitude: 37.2662,
    longitude: 127.0014,
  },
  {
    id: '9',
    date: '2026-04-01',
    emoji: '🍣',
    startTime: '19:30',
    endTime: '20:30',
    placeName: '스시 오마카세',
    category: 'restaurant',
    latitude: 37.2700,
    longitude: 127.0035,
  },
  {
    id: '10',
    date: '2026-04-01',
    emoji: '🎬',
    startTime: '21:00',
    endTime: '23:00',
    placeName: 'CGV 수원',
    category: 'entertainment',
    latitude: 37.2643,
    longitude: 127.0317,
  },
];
