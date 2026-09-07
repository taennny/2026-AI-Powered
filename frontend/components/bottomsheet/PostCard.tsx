/** 카드 자체의 탭 동작은 미정 — 지금은 사진만 눌러서 크게 볼 수 있다 */

import {useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
/**
 * RN 기본 `Image` 대신 `expo-image`를 쓴다 — 디스크 캐시가 앱 재시작 후에도 남아
 * 같은 날짜를 다시 열면 즉시 뜬다. 서버가 원본(3~5MB)을 그대로 주고 있어서
 * 첫 로딩은 여전히 느리다. 그건 서버가 썸네일을 만들어야 풀린다.
 */
import {Image} from 'expo-image';

import PhotoViewer from '@/components/common/PhotoViewer';
import {type TimelinePlace} from '@/services/calendarApi';
import {formatTimeFromISO} from '@/utils/formatDate';

type Props = {
  data: TimelinePlace;
};

/**
 * `expo-image`는 NativeWind의 className을 받지 않는다(cssInterop 미등록).
 * 여기만 인라인 style을 쓴다.
 */
const THUMBNAIL_STYLE = {
  width: 60,
  height: 60,
  borderRadius: 10,
  marginLeft: 12,
} as const;

export default function PostCard({data}: Props) {
  const {name, category, arrived_at, left_at, photos, thumbnails} = data;
  // 그 장소의 현지 시각으로 그린다 — 여행한 날은 카드마다 시간대가 다르다
  const offset = data.utc_offset_minutes;
  const timeLabel = `${formatTimeFromISO(arrived_at, offset)} ~ ${formatTimeFromISO(left_at, offset)}`;
  const firstPhoto = photos?.[0];
  // 카드는 축소본(~30KB), 확대는 원본(3~5MB). 서버가 축소본을 안 주면 원본으로 폴백한다
  const firstThumbnail = thumbnails?.[0] ?? firstPhoto;

  const [isZoomed, setIsZoomed] = useState(false);

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
            onPress={() => setIsZoomed(true)}
            activeOpacity={0.7}
            accessibilityLabel={`${name} 사진 크게 보기`}
          >
            <Image
              source={firstThumbnail}
              style={THUMBNAIL_STYLE}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          </TouchableOpacity>

          {/* 카드는 축소본을 썼으니 여기서 원본을 한 번 받는다 */}
          <PhotoViewer
            uri={firstPhoto}
            visible={isZoomed}
            onClose={() => setIsZoomed(false)}
          />
        </>
      )}
    </View>
  );
}
