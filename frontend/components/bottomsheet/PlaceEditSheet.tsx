/**
 * 장소 수정 시트. 두 단계다.
 *
 *   후보 고르기 → (없어요) → 이름 입력 (치는 동안 그 키워드로 다시 검색)
 *
 * 후보에는 카테고리가 딸려오므로, 고르면 카테고리를 따로 묻지 않는다.
 * 검색해도 안 나오는 장소(친구 집, 회의실)일 때만 칩으로 받는다.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomActionSheet from '@/components/common/BottomActionSheet';
import {PLACE_CATEGORY_CHIPS} from '@/constants/placeCategories';
import {useThemeColors} from '@/hooks/useThemeColors';
import {
  fetchPlaceCandidates,
  searchPlaceCandidates,
  type PlaceCandidate,
} from '@/services/placeApi';

/** 타이핑이 멈춘 뒤 검색을 건다 — 글자마다 쏘면 요청이 쌓인다 */
const SEARCH_DEBOUNCE_MS = 350;

type Props = {
  visible: boolean;
  placeId: string;
  currentName: string;
  onClose: () => void;
  onSubmit: (value: {
    name: string;
    category: string | null;
    kakaoPlaceId?: string | null;
  }) => void;
};

function CandidateRow({
  candidate,
  onPress,
}: {
  candidate: PlaceCandidate;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      className="py-3 border-b border-line"
    >
      <Text className="text-[14px] text-primary">{candidate.name}</Text>
      <Text className="text-[12px] text-tertiary mt-[2px]">
        {[candidate.category, `${Math.round(candidate.distance_m)}m`]
          .filter(Boolean)
          .join(' · ')}
      </Text>
    </TouchableOpacity>
  );
}

export default function PlaceEditSheet({
  visible,
  placeId,
  currentName,
  onClose,
  onSubmit,
}: Props) {
  const tc = useThemeColors();

  const [step, setStep] = useState<'candidates' | 'input'>('candidates');
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const [name, setName] = useState(currentName);
  const [category, setCategory] = useState<string | null>(null);
  const [matches, setMatches] = useState<PlaceCandidate[]>([]);

  // 늦게 온 응답이 최신 입력의 결과를 덮지 않게
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    setStep('candidates');
    setName(currentName);
    setCategory(null);
    setMatches([]);
    setFailed(false);
    setIsLoading(true);

    const requestId = ++requestIdRef.current;
    fetchPlaceCandidates(placeId)
      .then(list => {
        if (requestId !== requestIdRef.current) return;
        setCandidates(list);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setCandidates([]);
        setFailed(true);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });
  }, [visible, placeId, currentName]);

  // 입력 단계에서만 검색한다
  useEffect(() => {
    if (step !== 'input') return;

    const keyword = name.trim();
    if (!keyword) {
      setMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      searchPlaceCandidates(placeId, keyword)
        .then(list => {
          if (requestId === requestIdRef.current) setMatches(list);
        })
        .catch(() => {
          if (requestId === requestIdRef.current) setMatches([]);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [step, name, placeId]);

  const choose = useCallback(
    (candidate: PlaceCandidate) => {
      onSubmit({
        name: candidate.name,
        category: candidate.category,
        kakaoPlaceId: candidate.kakao_place_id,
      });
    },
    [onSubmit],
  );

  const canSave = name.trim().length > 0;

  return (
    <BottomActionSheet
      visible={visible}
      onClose={onClose}
      title={
        step === 'candidates'
          ? '실제 방문한 장소가 있나요?'
          : '장소 이름을 알려주세요'
      }
      description={
        step === 'candidates'
          ? `지금은 '${currentName}'으로 기록돼 있어요.`
          : undefined
      }
    >
      {step === 'candidates' ? (
        <View>
          {isLoading ? (
            <ActivityIndicator size="small" className="my-6" />
          ) : (
            <>
              {failed && (
                <Text className="text-[13px] text-tertiary py-3">
                  주변 장소를 불러오지 못했어요. 직접 입력할 수 있어요.
                </Text>
              )}

              {candidates.map(candidate => (
                <CandidateRow
                  key={`${candidate.name}-${candidate.distance_m}`}
                  candidate={candidate}
                  onPress={() => choose(candidate)}
                />
              ))}
            </>
          )}

          <TouchableOpacity
            onPress={() => setStep('input')}
            activeOpacity={0.6}
            className="py-4"
          >
            <Text className="text-[14px] text-secondary">없어요</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="장소 이름"
            placeholderTextColor={tc.tertiary}
            autoFocus
            returnKeyType="done"
            className="border border-line rounded-[10px] px-4 py-3 text-[15px] text-primary"
          />

          {matches.length > 0 && (
            <View className="mt-2">
              {matches.map(candidate => (
                <CandidateRow
                  key={`${candidate.name}-${candidate.distance_m}`}
                  candidate={candidate}
                  onPress={() => choose(candidate)}
                />
              ))}
            </View>
          )}

          {/* 지도에서 못 찾은 장소용 — 고른 후보가 있으면 카테고리가 딸려오므로 안 쓴다 */}
          <View className="flex-row flex-wrap gap-2 mt-4">
            {PLACE_CATEGORY_CHIPS.map(chip => {
              const selected = category === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  onPress={() => setCategory(selected ? null : chip)}
                  activeOpacity={0.7}
                  className={`px-3 py-[7px] rounded-[14px] border ${
                    selected ? 'bg-primary border-primary' : 'border-line'
                  }`}
                >
                  <Text
                    className={`text-[13px] ${selected ? 'text-btn-text' : 'text-secondary'}`}
                  >
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="flex-row justify-end mt-5">
            <TouchableOpacity onPress={onClose} className="px-5 py-3">
              <Text className="text-[13px] text-tertiary">취소</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => onSubmit({name: name.trim(), category})}
              disabled={!canSave}
              className={`ml-1 px-5 py-3 rounded-[8px] ${canSave ? 'bg-primary' : 'bg-line'}`}
            >
              <Text
                className={`text-[13px] ${canSave ? 'text-btn-text' : 'text-tertiary'}`}
              >
                저장
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </BottomActionSheet>
  );
}
