/**
 * @file app/(main)/(tabs)/index.tsx
 * @description
 * - (tabs) 진입 시 home으로 리다이렉트
 * - home, journal-list 두 폴더가 있어 자동 진입점을 못 찾기 때문에 명시적으로 지정
 */

import {Redirect} from 'expo-router';

export default function TabsIndex() {
  return <Redirect href="/(main)/(tabs)/home" />;
}
