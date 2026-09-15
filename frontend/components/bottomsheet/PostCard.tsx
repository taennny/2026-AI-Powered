/** 카드를 왼쪽으로 밀면 수정·삭제가 나온다. 사진은 눌러서 크게 볼 수 있다 */

import {useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
/**
 * RN 기본 `Image` 대신 `expo-image`를 쓴다 — 디스크 캐시가 앱 재시작 후에도 남아
 * 같은 날짜를 다시 열면 즉시 뜬다. 서버가 원본(3~5MB)을 그대로 주고 있어서
 * 첫 로딩은 여전히 느리다. 그건 서버가 썸네일을 만들어야 풀린다.
 */
import {Image} from 'expo-image';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import ActionMenu, {type MenuAction} from '@/components/common/ActionMenu';
import PhotoViewer from '@/components/common/PhotoViewer';
import SwipeableRow, {closeAnyOpenRow} from '@/components/common/SwipeableRow';
import PlaceEditSheet from '@/components/bottomsheet/PlaceEditSheet';
import {type TimelinePlace} from '@/services/calendarApi';
import {deletePlace, updatePlace} from '@/services/placeApi';
import {deletePlacePhoto, replacePlacePhoto} from '@/services/photoApi';
import {ensureMediaLibraryPermission} from '@/hooks/usePermissions';
import {useThemeColors} from '@/hooks/useThemeColors';
import {formatTimeFromISO} from '@/utils/formatDate';
import {logError} from '@/utils/logError';
import {describePlaceError} from '@/utils/placeError';

const CIRCLE = 48;
const CIRCLE_GAP = 12;
const ACTIONS_WIDTH = CIRCLE * 2 + CIRCLE_GAP + 24;

function ActionCircle({
  onPress,
  label,
  icon,
  color,
}: {
  onPress: () => void;
  label: string;
  icon: 'pencil' | 'trash';
  color: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      tension: 220,
      friction: 12,
    }).start();

  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable
        onPress={onPress}
        onPressIn={() => spring(0.88)}
        onPressOut={() => spring(1)}
        accessibilityLabel={label}
        style={{
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: CIRCLE / 2,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
}

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
  const tc = useThemeColors();
  const {name, category, arrived_at, left_at, photos, thumbnails} = data;
  // 그 장소의 현지 시각으로 그린다 — 여행한 날은 카드마다 시간대가 다르다
  const offset = data.utc_offset_minutes;
  const timeLabel = `${formatTimeFromISO(arrived_at, offset)} ~ ${formatTimeFromISO(left_at, offset)}`;
  const firstPhoto = photos?.[0];
  // 카드는 축소본(~30KB), 확대는 원본(3~5MB). 서버가 축소본을 안 주면 원본으로 폴백
  const firstThumbnail = thumbnails?.[0] ?? firstPhoto;

  const [isZoomed, setIsZoomed] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const handleEditPress = () => {
    closeAnyOpenRow();
    setIsMenuOpen(true);
  };

  const handlePhotoReplace = async () => {
    if (!(await ensureMediaLibraryPermission())) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // 원본은 3~5MB다. 카드 썸네일과 확대 보기엔 이 정도면 충분하다
      quality: 0.7,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    setIsBusy(true);
    try {
      // 파일명으로 형식을 추측하면 안드로이드에서 HEIC이 jpeg으로 올라가 표시가 깨진다
      await replacePlacePhoto(
        data.place_id,
        asset.uri,
        asset.fileName ?? 'photo.jpg',
        asset.mimeType,
      );
      onChanged?.();
    } catch (error) {
      logError('place photo replace', error);
      const {title, message} = describePlaceError(error, '수정');
      Alert.alert(title, message);
    } finally {
      setIsBusy(false);
    }
  };

  const removePhoto = async (block: boolean) => {
    setIsBusy(true);
    try {
      await deletePlacePhoto(data.place_id, block);
      onChanged?.();
    } catch (error) {
      logError('place photo delete', error);
      const {title, message} = describePlaceError(error, '삭제');
      Alert.alert(title, message);
    } finally {
      setIsBusy(false);
    }
  };

  const handlePhotoDelete = () => {
    Alert.alert(
      '사진 삭제',
      '카드에 붙은 사진을 삭제합니다. 앞으로 이 장소에 사진을 붙이지 않으려면 "앞으로 사진 안 붙이기"를 선택하세요.',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '이 사진만 삭제',
          style: 'destructive',
          onPress: () => removePhoto(false),
        },
        {
          text: '앞으로 사진 안 붙이기',
          style: 'destructive',
          onPress: () => removePhoto(true),
        },
      ],
    );
  };

  const menuActions: MenuAction[] = [
    {label: '장소 수정', onPress: () => setIsEditOpen(true)},
    {
      label: firstPhoto ? '사진 바꾸기' : '사진 추가',
      onPress: handlePhotoReplace,
    },
    ...(firstPhoto
      ? [{label: '사진 삭제', onPress: handlePhotoDelete, destructive: true}]
      : []),
  ];

  const handleSubmit = async (value: {
    name: string;
    category: string | null;
  }) => {
    setIsEditOpen(false);

    try {
      await updatePlace(data.place_id, value);
      onChanged?.();
    } catch (error) {
      logError('place update', error);
      const {title, message} = describePlaceError(error, '수정');
      Alert.alert(title, message);
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
            const {title, message} = describePlaceError(error, '삭제');
            Alert.alert(title, message);
          }
        },
      },
    ]);
  };

  const actions = (
    // 카드의 아래 여백만큼 띄워야 원이 카드 한가운데에 온다
    <View
      className="flex-1 flex-row items-center justify-center mb-[10px]"
      style={{gap: CIRCLE_GAP}}
    >
      <ActionCircle
        onPress={handleEditPress}
        label={`${name} 수정`}
        icon="pencil"
        color={tc.tealAccent}
      />
      <ActionCircle
        onPress={handleDeletePress}
        label={`${name} 삭제`}
        icon="trash"
        color={tc.danger}
      />
    </View>
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

          {isBusy && <ActivityIndicator size="small" className="ml-3" />}

          {!isBusy && firstPhoto && (
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

      <ActionMenu
        visible={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title={name}
        actions={menuActions}
      />

      <PlaceEditSheet
        visible={isEditOpen}
        placeId={data.place_id}
        currentName={name}
        currentCategory={category ?? null}
        lat={data.lat}
        lng={data.lng}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
