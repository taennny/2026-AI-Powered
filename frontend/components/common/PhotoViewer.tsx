/**
 * 사진 한 장을 전체 화면으로 띄운다. **아무 데나 누르면 닫힌다.**
 *
 * 지도 모달(`MapPreview`)과 달리 안쪽 탭을 막지 않는다 — 버튼이 없어서
 * 그게 유일한 조작이다.
 */

import {useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {Image} from 'expo-image';

type Props = {
  /** 보여줄 사진. 카드 썸네일과 같은 URL을 넘기면 캐시를 그대로 쓴다 */
  uri: string;
  visible: boolean;
  onClose: () => void;
};

/** 캐시를 메모리와 디스크 양쪽에 — 앱을 껐다 켜도 살아남는다 */
const CACHE_POLICY = 'memory-disk';

/** 받아온 뒤 켜지는 페이드 */
const FADE_MS = 200;

const IMAGE_STYLE = {width: '100%', height: '100%'} as const;

export default function PhotoViewer({uri, visible, onClose}: Props) {
  // 서버가 원본(3~5MB)을 그대로 줘서 큰 화면에서는 눈에 띄게 늦게 뜬다.
  // 검은 화면만 있으면 멈춘 것처럼 보인다
  const [isLoading, setIsLoading] = useState(true);

  return (
    // 안드로이드 하드웨어 뒤로가기도 닫기로 받는다
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // 두 번째로 열 때 캐시로 즉시 떠도 인디케이터가 남지 않게 매번 되돌린다
      onShow={() => setIsLoading(true)}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          className="flex-1 items-center justify-center p-5"
          style={{backgroundColor: 'rgba(0,0,0,0.9)'}}
        >
          {isLoading && (
            <ActivityIndicator
              size="large"
              color="#FFFFFF"
              style={{position: 'absolute'}}
            />
          )}

          {/* contain이라 원본 비율 그대로, 잘리지 않고 화면 안에 들어온다 */}
          <Image
            source={uri}
            style={IMAGE_STYLE}
            contentFit="contain"
            cachePolicy={CACHE_POLICY}
            transition={FADE_MS}
            onLoadEnd={() => setIsLoading(false)}
          />
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
