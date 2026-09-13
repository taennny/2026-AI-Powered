/** 카드를 왼쪽으로 밀면 수정·삭제가 나온다. 사진은 눌러서 크게 볼 수 있다 */

import {useState} from 'react';
import {Alert, Text, TouchableOpacity, View} from 'react-native';
/**
 * RN 기본 `Image` 대신 `expo-image`를 쓴다 — 디스크 캐시가 앱 재시작 후에도 남아
 * 같은 날짜를 다시 열면 즉시 뜬다. 서버가 원본(3~5MB)을 그대로 주고 있어서
 * 첫 로딩은 여전히 느리다. 그건 서버가 썸네일을 만들어야 풀린다.
 */
import {Image} from 'expo-image';

import PhotoViewer from '@/components/common/PhotoViewer';
import SwipeableRow, {closeAnyOpenRow} from '@/components/common/SwipeableRow';
import PlaceEditSheet from '@/components/bottomsheet/PlaceEditSheet';
import {type TimelinePlace} from '@/services/calendarApi';
import {deletePlace, updatePlace} from '@/services/placeApi';
import {formatTimeFromISO} from '@/utils/formatDate';
import {logError} from '@/utils/logError';

const ACTION_WIDTH = 72;
const ACTIONS_WIDTH = ACTION_WIDTH * 2;

type Props = {
  data: TimelinePlace;
  /** 수정·삭제가 끝나면 타임라인을 다시 받아야 한다 */
  onChanged?: () => void;
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

export default function PostCard({data, onChanged}: Props) {
  const {name, category, arrived_at, left_at, photos, thumbnails} = data;
  // 그 장소의 현지 시각으로 그린다 — 여행한 날은 카드마다 시간대가 다르다
  const offset = data.utc_offset_minutes;
  const timeLabel = `${formatTimeFromISO(arrived_at, offset)} ~ ${formatTimeFromISO(left_at, offset)}`;
  const firstPhoto = photos?.[0];
  // 카드는 축소본(~30KB), 확대는 원본(3~5MB). 서버가 축소본을 안 주면 원본으로 폴백한다
  const firstThumbnail = thumbnails?.[0] ?? firstPhoto;

  const [isZoomed, setIsZoomed] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleEditPress = () => {
    closeAnyOpenRow();
    setIsEditOpen(true);
  };

  const handleSubmit = async (value: {
    name: string;
    category: string | null;
    kakaoPlaceId?: string | null;
  }) => {
    setIsEditOpen(false);

    try {
      await updatePlace(data.place_id, {
        name: value.name,
        category: value.category,
        kakao_place_id: value.kakaoPlaceId,
      });
      onChanged?.();
    } catch (error) {
      logError('place update', error);
      Alert.alert('오류', '장소를 수정하지 못했어요. 다시 시도해주세요.');
    }
  };

  const handleDeletePress = () => {
    Alert.alert('장소 삭제', `'${name}'을(를) 타임라인에서 지울까요?`, [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          closeAnyOpenRow();
          try {
            await deletePlace(data.place_id);
            onChanged?.();
          } catch (error) {
            logError('place delete', error);
            Alert.alert('오류', '장소를 지우지 못했어요. 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const actions = (
    <>
      <TouchableOpacity
        onPress={handleEditPress}
        activeOpacity={0.7}
        className="flex-1 items-center justify-center bg-teal-dark rounded-l-[14px] mb-[10px]"
      >
        <Text className="text-[13px] font-semibold text-btn-text">수정</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDeletePress}
        activeOpacity={0.7}
        className="flex-1 items-center justify-center bg-[#E5544B] rounded-r-[14px] mb-[10px]"
      >
        <Text className="text-[13px] font-semibold text-white">삭제</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <>
      <SwipeableRow actions={actions} actionsWidth={ACTIONS_WIDTH}>
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
      </SwipeableRow>

      <PlaceEditSheet
        visible={isEditOpen}
        placeId={data.place_id}
        currentName={name}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
