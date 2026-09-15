/** iOS는 시스템 액션시트, 안드로이드는 같은 모양의 바텀시트로 동작을 고르게 한다 */

import {useEffect, useRef} from 'react';
import {ActionSheetIOS, Platform, Text, TouchableOpacity} from 'react-native';

import BottomActionSheet from '@/components/common/BottomActionSheet';
import {useThemeColors} from '@/hooks/useThemeColors';

export type MenuAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: MenuAction[];
};

export default function ActionMenu({visible, onClose, title, actions}: Props) {
  const tc = useThemeColors();
  const isIOS = Platform.OS === 'ios';

  // 최신 값을 참조만 한다 — 의존성에 넣으면 매 렌더 새 배열이라 시트가 겹쳐 뜬다
  const latest = useRef({actions, title, onClose});
  latest.current = {actions, title, onClose};

  const shownRef = useRef(false);

  useEffect(() => {
    if (!isIOS) return;

    if (!visible) {
      shownRef.current = false;
      return;
    }
    if (shownRef.current) return;
    shownRef.current = true;

    const {actions: items, title: heading, onClose: close} = latest.current;
    // 취소를 마지막에 붙인다 — iOS는 맨 아래 별도 버튼으로 그린다
    const options = [...items.map(a => a.label), '취소'];
    const destructiveButtonIndex = items.findIndex(a => a.destructive);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: heading,
        options,
        cancelButtonIndex: items.length,
        ...(destructiveButtonIndex >= 0 ? {destructiveButtonIndex} : {}),
      },
      index => {
        close();
        if (index < items.length) items[index].onPress();
      },
    );
  }, [isIOS, visible]);

  if (isIOS) return null;

  return (
    <BottomActionSheet visible={visible} onClose={onClose} title={title}>
      {actions.map(action => (
        <TouchableOpacity
          key={action.label}
          onPress={() => {
            onClose();
            action.onPress();
          }}
          activeOpacity={0.6}
          className="py-4 border-b border-line"
        >
          <Text
            className="text-[15px]"
            style={{color: action.destructive ? tc.danger : tc.primary}}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </BottomActionSheet>
  );
}
