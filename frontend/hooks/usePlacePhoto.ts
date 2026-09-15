import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import {ensureMediaLibraryPermission} from '@/hooks/usePermissions';
import {deletePlacePhoto, replacePlacePhoto} from '@/services/photoApi';
import {logError} from '@/utils/logError';
import {describePlaceError} from '@/utils/placeError';

const PICKER_QUALITY = 0.7;

export function usePlacePhoto(placeId: string, onChanged?: () => void) {
  const [isBusy, setIsBusy] = useState(false);

  const run = useCallback(
    async (task: () => Promise<void>, action: '수정' | '삭제') => {
      setIsBusy(true);
      try {
        await task();
        onChanged?.();
      } catch (error) {
        logError(`place photo ${action}`, error);
        const {title, message} = describePlaceError(error, action);
        Alert.alert(title, message);
      } finally {
        setIsBusy(false);
      }
    },
    [onChanged],
  );

  const replace = useCallback(async () => {
    if (!(await ensureMediaLibraryPermission())) return;

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: PICKER_QUALITY,
    });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    await run(
      () =>
        replacePlacePhoto(
          placeId,
          asset.uri,
          asset.fileName ?? 'photo.jpg',
          asset.mimeType,
        ).then(() => undefined),
      '수정',
    );
  }, [placeId, run]);

  const remove = useCallback(
    (block: boolean) => run(() => deletePlacePhoto(placeId, block), '삭제'),
    [placeId, run],
  );

  const confirmRemove = useCallback(() => {
    Alert.alert(
      '사진 삭제',
      '카드에 붙은 사진을 삭제합니다. 앞으로 이 장소에 사진을 붙이지 않으려면 "앞으로 사진 안 붙이기"를 선택하세요.',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '이 사진만 삭제',
          style: 'destructive',
          onPress: () => remove(false),
        },
        {
          text: '앞으로 사진 안 붙이기',
          style: 'destructive',
          onPress: () => remove(true),
        },
      ],
    );
  }, [remove]);

  return {isBusy, replace, confirmRemove};
}
