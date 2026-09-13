/**
 * 아래에서 올라오는 시트. 바깥은 어둡게 깔아 시트에 집중시킨다.
 *
 * `Modal`을 쓰는 이유는 RN이 별도 레이어에 그려서, 밑에 깔린 홈 바텀시트의
 * PanResponder와 부딪히지 않기 때문이다.
 */

import {Modal, Pressable, Text, View} from 'react-native';

type Props = {
  visible: boolean;
  /** 배경을 누르거나 안드로이드 뒤로가기 */
  onClose: () => void;
  title?: string;
  description?: string;
  /**
   * 화면 높이 대비 시트 높이(0~1). 주면 그 높이로 고정되고 내용이 남은 자리를 채운다 —
   * 목록이 길어 안에서 스크롤해야 할 때 쓴다. 없으면 내용만큼만 올라온다.
   */
  heightRatio?: number;
  children: React.ReactNode;
};

export default function BottomActionSheet({
  visible,
  onClose,
  title,
  description,
  heightRatio,
  children,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* 배경 탭으로 닫는다. 시트 안쪽 탭이 여기까지 새지 않게 형제로 둔다 */}
        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        />

        <View
          className="rounded-t-[20px] bg-card px-6 pt-3 pb-8"
          style={heightRatio ? {height: `${heightRatio * 100}%`} : undefined}
        >
          <View className="w-10 h-1 rounded-full bg-line self-center mb-4" />

          {title && (
            <Text className="text-[15px] font-semibold text-primary">
              {title}
            </Text>
          )}
          {description && (
            <Text className="mt-1 text-[12px] leading-[17px] text-tertiary">
              {description}
            </Text>
          )}

          <View
            className={title || description ? 'mt-4' : undefined}
            style={heightRatio ? {flex: 1} : undefined}
          >
            {children}
          </View>
        </View>
      </View>
    </Modal>
  );
}
