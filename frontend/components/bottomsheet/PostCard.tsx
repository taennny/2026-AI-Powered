/** 카드 자체의 탭 동작은 미정 — 지금은 사진만 눌러서 크게 볼 수 있다 */

import {useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
/**
 * RN 기본 `Image` 대신 `expo-image`를 쓴다 — 디스크 캐시가 앱 재시작 후에도 남아
 * 같은 날짜를 다시 열면 즉시 뜬다. 서버가 원본(3~5MB)을 그대로 주고 있어서
 * 첫 로딩은 여전히 느리다. 그건 서버가 썸네일을 만들어야 풀린다.
 */
import {Image} from 'expo-image';

import {type TimelinePlace} from '@/services/calendarApi';
import {formatTimeFromISO} from '@/utils/formatDate';

type Props = {
  data: TimelinePlace;
};

/** 캐시를 메모리와 디스크 양쪽에 — 앱을 껐다 켜도 살아남는다 */
const CACHE_POLICY = 'memory-disk';

/** 받아온 뒤 켜지는 페이드. 툭 나타나는 것보다 덜 거슬린다 */
const FADE_MS = 200;

/**
 * `expo-image`는 NativeWind의 className을 받지 않는다(cssInterop 미등록).
 * 이 두 곳만 인라인 style을 쓴다.
 */
const THUMBNAIL_STYLE = {
  width: 60,
  height: 60,
  borderRadius: 10,
  marginLeft: 12,
} as const;

const FULL_IMAGE_STYLE = {width: '100%', height: '100%'} as const;

export default function PostCard({data}: Props) {
  const {name, category, arrived_at, left_at, photos} = data;
  const timeLabel = `${formatTimeFromISO(arrived_at)} ~ ${formatTimeFromISO(left_at)}`;
  const firstPhoto = photos?.[0];

  const [isZoomed, setIsZoomed] = useState(false);
  // 서버가 주는 건 원본이라 큰 화면에서는 눈에 띄게 늦게 뜬다
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
              source={firstPhoto}
              style={THUMBNAIL_STYLE}
              contentFit="cover"
              cachePolicy={CACHE_POLICY}
              transition={FADE_MS}
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

                {/* contain이라 원본 비율 그대로, 잘리지 않고 화면 안에 들어온다.
                    카드 썸네일과 같은 URL이라 캐시가 그대로 재사용된다 */}
                <Image
                  source={firstPhoto}
                  style={FULL_IMAGE_STYLE}
                  contentFit="contain"
                  cachePolicy={CACHE_POLICY}
                  transition={FADE_MS}
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
