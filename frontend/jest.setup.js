// 기기 로컬 시간에 의존하는 함수(formatDate, formatTimeFromISO)가 있어서
// 실행 환경의 tz에 따라 결과가 달라진다. 국내 사용자 기준으로 고정한다.
// 해외 지원(기기 tz)으로 넘어가면 이 값을 바꿔가며 테스트할 대상이 된다.
process.env.TZ = 'Asia/Seoul';

// AsyncStorage는 네이티브 모듈이라 JS 테스트 환경에 없다. 패키지가 제공하는
// 인메모리 목으로 갈아끼운다 (테스트마다 AsyncStorage.clear()로 비울 것).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// SecureStore도 네이티브 모듈(Keychain/Keystore)이라 JS 환경에 없다.
// 토큰 저장소가 이걸 쓰므로 인메모리 목을 둔다 — AsyncStorage 목과 별개의
// 저장 공간이어야 마이그레이션(평문 → 보안 저장소) 동작을 테스트할 수 있다.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    // 잠금 중에도 읽히고, 백업·기기 이전에는 따라가지 않는 접근성 레벨
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 2,
    isAvailableAsync: jest.fn(async () => true),
    getItemAsync: jest.fn(async key =>
      store.has(key) ? store.get(key) : null,
    ),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async key => {
      store.delete(key);
    }),
    __clear: () => store.clear(),
  };
});
