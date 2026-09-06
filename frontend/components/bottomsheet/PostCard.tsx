/** 카드 자체의 탭 동작은 미정 — 지금은 사진만 눌러서 크게 볼 수 있다 */

import {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import {type TimelinePlace} from '@/services/calendarApi';
import {formatTimeFromISO} from '@/utils/formatDate';

type Props = {
  data: TimelinePlace;
};

export default function PostCard({data}: Props) {
  const {name, category, arrived_at, left_at, photos} = data;
  const timeLabel = `${formatTimeFromISO(arrived_at)} ~ ${formatTimeFromISO(left_at)}`;
  const firstPhoto = photos?.[0];

  const [isZoomed, setIsZoomed] = useState(false);
  // 서버가 주는 건 원본(3~5MB)이라 큰 화면에서는 눈에 띄게 늦게 뜬다
  const [isImageLoading, setIsImageLoading] = useState(true);

  const openZoom = () => {
    setIsImageLoading(true);
    setIsZoomed(true);
  };

  return (
    <View
      className="bg-card rounded-[14px] px-4 py-[14px] mb-[10px] flex-row justify-between items-center"
      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.06)'}}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-primary mb-1">
          {timeLabel}
        </Text>
        <Text className="text-[13px] text-medium mb-0.5">{name}</Text>
        <Text className="text-xs text-tertiary">{category}</Text>
      </View>

      {firstPhoto && (
        <>
          <TouchableOpacity
            onPress={openZoom}
            activeOpacity={0.7}
            accessibilityLabel={`${name} 사진 크게 보기`}
          >
            <Image
              source={{uri: firstPhoto}}
              className="w-[60px] h-[60px] rounded-[10px] ml-3"
            />
          </TouchableOpacity>

          {/* 안드로이드 하드웨어 뒤로가기도 닫기로 받는다 */}
          <Modal
            visible={isZoomed}
            transparent
            animationType="fade"
            onRequestClose={() => setIsZoomed(false)}
          >
            {/* 지도 모달과 달리 안쪽 탭을 막지 않는다 — 버튼이 없어서
                "아무 데나 누르면 닫힌다"가 유일한 조작이다 */}
            <TouchableWithoutFeedback onPress={() => setIsZoomed(false)}>
              <View
                className="flex-1 items-center justify-center p-5"
                style={{backgroundColor: 'rgba(0,0,0,0.9)'}}
              >
                {isImageLoading && (
                  <ActivityIndicator
                    size="large"
                    color="#FFFFFF"
                    style={{position: 'absolute'}}
                  />
                )}

                {/* contain이라 원본 비율 그대로, 잘리지 않고 화면 안에 들어온다 */}
                <Image
                  source={{uri: firstPhoto}}
                  style={{width: '100%', height: '100%'}}
                  resizeMode="contain"
                  onLoadEnd={() => setIsImageLoading(false)}
                />
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </>
      )}
    </View>
  );
}
