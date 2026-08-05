// 기기 로컬 시간에 의존하는 함수(formatDate, formatTimeFromISO)가 있어서
// 실행 환경의 tz에 따라 결과가 달라진다. 국내 사용자 기준으로 고정한다.
// 해외 지원(기기 tz)으로 넘어가면 이 값을 바꿔가며 테스트할 대상이 된다.
process.env.TZ = 'Asia/Seoul';

// AsyncStorage는 네이티브 모듈이라 JS 테스트 환경에 없다. 패키지가 제공하는
// 인메모리 목으로 갈아끼운다 (테스트마다 AsyncStorage.clear()로 비울 것).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
