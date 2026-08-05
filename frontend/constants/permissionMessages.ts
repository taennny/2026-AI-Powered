import {Platform} from 'react-native';

/** 기기별 설정 경로 — 사용자가 실제로 찾아갈 수 있게 메뉴 이름 그대로 적는다 */
function settingsPath(menu: string): string {
  return Platform.OS === 'ios'
    ? `설정 > Roame > ${menu}`
    : `설정 > 애플리케이션 > Roame > 권한 > ${menu}`;
}

export const PERMISSION_MESSAGES = {
  locationForeground: {
    title: '위치 권한이 꼭 필요해요',
    message:
      'Roame은 걸어다닌 곳을 자동으로 기록해서 하루의 타임라인을 만들어요.\n\n' +
      '위치 권한이 없으면 이동이 전혀 저장되지 않아 타임라인이 계속 비어 있고, ' +
      '기록이 없으면 저널도 쓸 수 없어요.\n\n' +
      `${settingsPath('위치')}에서 권한을 허용해주세요.`,
  },
  locationBackground: {
    title: '위치를 "항상 허용"으로 바꿔주세요',
    message:
      '지금은 앱을 켜서 보고 있는 동안에만 위치가 기록돼요.\n\n' +
      '화면을 끄거나 다른 앱을 쓰는 사이의 이동은 전부 빠지기 때문에, ' +
      '하루 타임라인이 군데군데 끊긴 채로 남습니다.\n\n' +
      `${settingsPath('위치')}에서 "항상"을 선택해주세요.`,
  },
  mediaLibrary: {
    title: '사진 접근 권한이 필요해요',
    message:
      '사진을 불러올 수 없어서 타임라인과 저널에 사진을 넣을 수 없어요.\n\n' +
      '그날의 기록에 글자만 남게 됩니다.\n\n' +
      `${settingsPath('사진')}에서 접근을 허용해주세요.`,
  },
} as const;
