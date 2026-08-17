import {Stack} from 'expo-router';

/**
 * 설정만 별도 스택 — 여기서만 스와이프 뒤로가기를 살리려고 감쌌다.
 * 제스처 설정은 네비게이터 단위라 바깥(`(main)/_layout`)은 끈 채로 안쪽만 켤 수 있다.
 * 설정 첫 화면에서 홈으로 나가는 건 바깥 스택이라 여전히 막혀 있다.
 */
export default function SettingsLayout() {
  return <Stack screenOptions={{headerShown: false, gestureEnabled: true}} />;
}
