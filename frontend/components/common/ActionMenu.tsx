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

      <TouchableOpacity onPress={onClose} activeOpacity={0.6} className="py-4">
        <Text className="text-[15px] text-tertiary">취소</Text>
      </TouchableOpacity>
    </BottomActionSheet>
  );
}
