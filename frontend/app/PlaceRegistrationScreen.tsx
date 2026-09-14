
import React, {useEffect, useRef, useState} from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {router} from 'expo-router';
import {api} from '@/utils/api';
import {markPlaceRegistrationDone} from '@/utils/onboardingStorage';

type Screen = 'intro' | 'search' | 'naming';

type PlaceType = 'frequent' | 'home' | 'workSchool';

type Place = {
  id: string;
  type: PlaceType;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};


export default function PlaceRegistrationScreen() {
  const [screen, setScreen] = useState<Screen>('intro');

  const [places, setPlaces] = useState<Place[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [placeName, setPlaceName] = useState('');
  const [selectedPlaceType, setSelectedPlaceType] =
    useState<PlaceType>('frequent');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleOpacity = useRef(new Animated.Value(1)).current;

  const searchOpacity = useRef(new Animated.Value(1)).current;
  const searchTranslateY = useRef(new Animated.Value(0)).current;

  const namingOpacity = useRef(new Animated.Value(0)).current;
  const namingTranslateY = useRef(new Animated.Value(15)).current;

  const nicknameInputRef = useRef<TextInput>(null);

  /*
   * 장소 이름 입력 화면 진입 시 자동 포커스
   */
  useEffect(() => {
    if (screen !== 'naming') {
      return;
    }

    const timer = setTimeout(() => {
      nicknameInputRef.current?.focus();
    }, 450);

    return () => clearTimeout(timer);
  }, [screen]);

    useEffect(() => {
    const fetchFrequentPlaces = async () => {
      try {
        const response = await api.get('/api/v1/places/frequent');

        const fetchedPlaces: Place[] = response.data.places.map(
          (place: any) => ({
            id: place.place_id,
            type: place.place_type,
            name: place.name,
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
          }),
        );

        setPlaces(fetchedPlaces);
      } catch (error) {
        console.error('자주 가는 장소 조회 실패:', error);
      }
    };

    fetchFrequentPlaces();
  }, []);

  /*
   * 검색 화면 열기
   */
  const openSearch = (type: PlaceType) => {
    setSelectedPlaceType(type);
    setSearchText('');
    setSelectedPlace(null);
    setPlaceName('');

    setScreen('search');

    titleOpacity.setValue(1);

    searchOpacity.setValue(1);
    searchTranslateY.setValue(0);

    namingOpacity.setValue(0);
    namingTranslateY.setValue(15);
  };

  /*
   * 장소 선택 → 이름 지정 화면
   */
  const animateToNaming = (place: Place) => {
    setSelectedPlace(place);

    Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),

      Animated.timing(searchOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),

      Animated.timing(searchTranslateY, {
        toValue: 15,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setScreen('naming');

      titleOpacity.setValue(0);
      namingOpacity.setValue(0);
      namingTranslateY.setValue(15);

      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),

        Animated.timing(namingOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),

        Animated.timing(namingTranslateY, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, 150);
  };

  /*
   * 검색 결과 선택
   */
  const handleSearchResult = (place: Place) => {
    animateToNaming(place);
  };

  /*
   * 현재 위치
   *
   * 현재는 실제 GPS API를 연결하지 않은 상태이므로
   * 테스트용 주소를 사용한다.
   *
   * 추후 expo-location + 주소 변환 API 연결 가능
   */
    /*
   * 현재 위치
   */
  const handleCurrentLocation = async () => {
    try {
      const {status} =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          '위치 권한 필요',
          '현재 위치를 사용하려면 위치 권한을 허용해주세요.',
        );
        return;
      }

      const location =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const {latitude, longitude} = location.coords;

      console.log('현재 위치:', latitude, longitude);

      const response = await api.get(
        '/api/v1/places/frequent/reverse-geocode',
        {
          params: {
            latitude,
            longitude,
          },
        },
      );

      const address = response.data.address;

      console.log('현재 위치 주소:', address);

      const currentLocationPlace: Place = {
        id: `current-${Date.now()}`,
        type: selectedPlaceType,
        name: '',
        address,
        latitude,
        longitude,
      };

      animateToNaming(currentLocationPlace);
    } catch (error: any) {
      console.error('현재 위치 조회 실패:', error);

      const message =
        error?.response?.data?.detail ??
        '현재 위치를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.';

      Alert.alert('현재 위치 조회 실패', message);
    }
  };

  /*
   * 뒤로가기
   */
  const handleBack = () => {
    if (screen === 'intro') {
      router.back();
      return;
    }

    if (screen === 'naming') {
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),

        Animated.timing(namingOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),

        Animated.timing(namingTranslateY, {
          toValue: 15,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setScreen('search');
        setPlaceName('');

        titleOpacity.setValue(0);

        searchOpacity.setValue(0);
        searchTranslateY.setValue(15);

        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),

          Animated.timing(searchOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),

          Animated.timing(searchTranslateY, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 150);

      return;
    }

    setScreen('intro');
    setSearchText('');
  };

  /*
   * 장소 등록
   */
  const handleConfirm = async () => {
  const trimmedName = placeName.trim();

  if (!selectedPlace || !trimmedName || isSubmitting) {
    return;
  }

  setIsSubmitting(true);

  try {
    const response = await api.post('/api/v1/places/frequent', {
      name: trimmedName,
      place_type: selectedPlaceType,
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
    });

    const registeredPlace: Place = {
      id: response.data.place_id,
      type: response.data.place_type,
      name: response.data.name,
      address: response.data.address,
      latitude: response.data.latitude,
      longitude: response.data.longitude,
    };

    setPlaces(currentPlaces => {
  if (selectedPlaceType === 'frequent') {
    return [...currentPlaces, registeredPlace];
  }

  return [
    ...currentPlaces.filter(place => place.type !== selectedPlaceType),
    registeredPlace,
  ];
});

    await markPlaceRegistrationDone();

    setSelectedPlace(null);
    setPlaceName('');
    setSearchText('');
    setSearchResults([]);

    setScreen('intro');

    titleOpacity.setValue(1);

    searchOpacity.setValue(1);
    searchTranslateY.setValue(0);

    namingOpacity.setValue(0);
    namingTranslateY.setValue(15);
  } catch (error: any) {
    console.error('장소 등록 실패:', error);

    const message =
      error?.response?.data?.detail ??
      '장소 등록에 실패했습니다. 잠시 후 다시 시도해주세요.';

    Alert.alert('장소 등록 실패', message);
  } finally {
    setIsSubmitting(false);
  }
};

  /*
   * 나중에 설정
   */
  const handleSkip = () => {
    router.replace('/onboarding');
  };

useEffect(() => {
  const query = searchText.trim();

  if (!query) {
    setSearchResults([]);
    return;
  }

  const timer = setTimeout(async () => {
    try {

      const response = await api.get('/api/v1/places/frequent/search', {
        params: {
          query,
        },
      });

      const results: Place[] = response.data.results.map(
        (place: any, index: number) => ({
          id: `${place.latitude}-${place.longitude}-${index}`,
          type: 'frequent',
          name: place.place_name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
        }),
      );

      setSearchResults(results);
    }   catch (error: any) {
  console.log('검색 실패 상태:', error?.response?.status);
  console.log('검색 실패 내용:', error?.response?.data);
  console.log('검색 요청 URL:', error?.config?.url);
  console.log('검색 요청 파라미터:', error?.config?.params);

  setSearchResults([]);
}
  }, 300);

  return () => clearTimeout(timer);
}, [searchText]);
  /*
   * INTRO SCREEN
   */
  if (screen === 'intro') {
    const frequentPlaces = places.filter(
      place => place.type === 'frequent',
    );

    const homePlace = places.find(
      place => place.type === 'home',
    );

    const workSchoolPlace = places.find(
      place => place.type === 'workSchool',
    );

    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
        }}>
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
          }}>
          <View
            style={{
              height: 64,
              justifyContent: 'center',
            }}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{
                width: 40,
                height: 40,
                marginLeft: -8,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontSize: 32,
                  lineHeight: 34,
                  fontWeight: '300',
                  color: '#191F28',
                }}>
                ‹
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              paddingTop: 24,
            }}>
            <Text
              style={{
                fontSize: 26,
                lineHeight: 30,
                fontWeight: '700',
                color: '#191F28',
                letterSpacing: -0.5,
                marginBottom: 14,
              }}>
              반가워요!{'\n'}주로 머무는 장소를{'\n'}알려주세요
            </Text>

            <Text
              style={{
                fontSize: 13,
                lineHeight: 19,
                color: '#8B95A1',
                marginBottom: 32,
              }}>
              자주 가는 곳을 등록해두면{'\n'}
              위치가 튀지 않고 정확하게 기록돼요.
            </Text>

            <View style={{gap: 12}}>
              {/* 자주 가는 장소 */}
              <View>
                <Pressable
                  onPress={() => openSearch('frequent')}
                  style={{
                    height: 70,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderWidth: 1,
                    borderColor: '#E5E8EB',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                  }}>
                  <View style={{flex: 1}}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: '#191F28',
                      }}>
                      📍 새로운 장소 등록
                    </Text>

                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: '#8B95A1',
                      }}>
                      단골 카페, 헬스장 등 직접 추가
                    </Text>
                  </View>

                  <View
                    style={{
                      borderRadius: 7,
                      backgroundColor: '#191F28',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#FFFFFF',
                      }}>
                      추가
                    </Text>
                  </View>
                </Pressable>

                {/* 등록된 자주 가는 장소 */}
                {frequentPlaces.map(place => (
                  <View
                    key={place.id}
                    style={{
                      marginTop: 8,
                      minHeight: 58,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderWidth: 1,
                      borderColor: '#E5E8EB',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                    }}>
                    <View
                      style={{
                        flex: 1,
                        paddingRight: 10,
                      }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '600',
                          color: '#191F28',
                        }}>
                        📍 {place.name}
                      </Text>

                      <Text
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color: '#8B95A1',
                        }}>
                        {place.address}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* 집 */}
              <Pressable
                onPress={() => openSearch('home')}
                style={{
                  minHeight: 70,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: '#E5E8EB',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}>
                <View
                  style={{
                    flex: 1,
                    paddingRight: 10,
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#191F28',
                    }}>
                    🏠 집
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: '#8B95A1',
                    }}>
                    {homePlace
                      ? homePlace.address
                      : '아직 등록되지 않았어요.'}
                  </Text>
                </View>

                <View
                  style={{
                    borderRadius: 7,
                    backgroundColor: '#F2F4F6',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: homePlace
                        ? '#8B95A1'
                        : '#191F28',
                    }}>
                    {homePlace ? '등록됨' : '등록'}
                  </Text>
                </View>
              </Pressable>

              {/* 회사 / 학교 */}
              <Pressable
                onPress={() => openSearch('workSchool')}
                style={{
                  minHeight: 70,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: '#E5E8EB',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                }}>
                <View
                  style={{
                    flex: 1,
                    paddingRight: 10,
                  }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#191F28',
                    }}>
                    💼 회사 / 학교
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: '#8B95A1',
                    }}>
                    {workSchoolPlace
                      ? workSchoolPlace.address
                      : '아직 등록되지 않았어요.'}
                  </Text>
                </View>

                <View
                  style={{
                    borderRadius: 7,
                    backgroundColor: '#F2F4F6',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: workSchoolPlace
                        ? '#8B95A1'
                        : '#191F28',
                    }}>
                    {workSchoolPlace ? '등록됨' : '등록'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {places.length > 0 ? (
  <Pressable
    onPress={handleSkip}
    style={{
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#191F28',
      borderRadius: 16,
      marginBottom: 24,
    }}>
    <Text
      style={{
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
      }}>
      완료하기
    </Text>
  </Pressable>
) : (
  <Pressable
    onPress={handleSkip}
    style={{
      paddingVertical: 24,
      alignItems: 'center',
    }}>
    <Text
      style={{
        fontSize: 13,
        color: '#8B95A1',
        textDecorationLine: 'underline',
      }}>
      나중에 설정할게요
    </Text>
  </Pressable>
)}
        </View>
      </SafeAreaView>
    );
  }

  /*
   * SEARCH + NAMING SCREEN
   */
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
      }}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{flex: 1}}>
          {/* 상단 뒤로가기 */}
          <View
            style={{
              height: 64,
              paddingHorizontal: 24,
              justifyContent: 'center',
            }}>
            <Pressable
              onPress={handleBack}
              hitSlop={12}
              style={{
                width: 40,
                height: 40,
                marginLeft: -8,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontSize: 32,
                  lineHeight: 34,
                  fontWeight: '300',
                  color: '#191F28',
                }}>
                ‹
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              paddingHorizontal: 24,
            }}>
            {/* 제목 */}
            <Animated.View
              style={{
                opacity: titleOpacity,
                position: 'absolute',
                left: 24,
                right: 24,
                top: 10,
                zIndex: 2,
              }}>
              <Text
                style={{
                  fontSize: 26,
                  lineHeight: 36,
                  fontWeight: '700',
                  color: '#191F28',
                  letterSpacing: -0.5,
                }}>
                {screen === 'search'
                  ? '어떤 장소를\n추가할까요?'
                  : '이 장소의 이름을\n정해주세요'}
              </Text>
            </Animated.View>

            {/* SEARCH */}
            <Animated.View
              pointerEvents={screen === 'search' ? 'auto' : 'none'}
              style={{
                flex: 1,
                paddingTop: 112,
                opacity: searchOpacity,
                transform: [
                  {translateY: searchTranslateY},
                ],
              }}>
              <View style={{position: 'relative'}}>
                <TextInput
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="도로명, 지번, 건물명 검색"
                  placeholderTextColor="#B0B8C1"
                  autoCorrect={false}
                  autoFocus
                  style={{
                    height: 58,
                    backgroundColor: '#F2F4F6',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingLeft: 46,
                    fontSize: 17,
                    fontWeight: '500',
                    color: '#191F28',
                  }}
                />

                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: 18,
                    width: 22,
                    height: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text
                    style={{
                      fontSize: 23,
                      color: '#8B95A1',
                    }}>
                    ⌕
                  </Text>
                </View>
              </View>

              {searchText.trim().length === 0 ? (
                <Pressable
                  onPress={handleCurrentLocation}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: '100%',
                    marginTop: 8,
                    paddingVertical: 16,
                    paddingHorizontal: 8,
                    borderRadius: 16,
                  }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#E8F3FF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                    }}>
                    <Text
                      style={{
                        fontSize: 18,
                        color: '#4995FF',
                      }}>
                      ⌖
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#4995FF',
                    }}>
                    현재 위치로 찾기
                  </Text>
                </Pressable>
              ) : (
                <View style={{marginTop: 8}}>{searchResults.map
                  ((place, index) => (
                    <Pressable
                      key={place.id}
                      onPress={() =>
                        handleSearchResult(place)
                      }
                      style={{
                        paddingVertical: 16,
                        paddingHorizontal: 8,
                        borderBottomWidth:
                          index ===
                          searchResults.length - 1
                            ? 0
                            : 1,
                        borderBottomColor: '#E5E8EB',
                      }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: '#191F28',
                          marginBottom: 4,
                        }}>
                        {place.name}
                      </Text>

                      <Text
                        style={{
                          fontSize: 13,
                          color: '#8B95A1',
                        }}>
                        {place.address}
                      </Text>
                    </Pressable>
                  ))}

                  {searchResults.length === 0 && (
                    <Text
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 20,
                        fontSize: 14,
                        color: '#8B95A1',
                      }}>
                      검색 결과가 없습니다.
                    </Text>
                  )}
                </View>
              )}
            </Animated.View>

            {/* NAMING */}
            <Animated.View
              pointerEvents={screen === 'naming' ? 'auto' : 'none'}
              style={{
                flex: 1,
                paddingTop: 112,
                opacity: namingOpacity,
                transform: [
                  {translateY: namingTranslateY},
                ],
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: '#F9FAFB',
                  borderWidth: 1,
                  borderColor: '#E5E8EB',
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 32,
                }}>
                <Text
                  style={{
                    fontSize: 22,
                    color: '#8B95A1',
                    marginRight: 12,
                    marginTop: -2,
                  }}>
                  ⌖
                </Text>

                <View style={{flex: 1}}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#8B95A1',
                      marginBottom: 4,
                    }}>
                    선택된 주소
                  </Text>

                  <Text
                    style={{
                      fontSize: 16,
                      lineHeight: 23,
                      fontWeight: '600',
                      color: '#191F28',
                    }}>
                    {selectedPlace?.address}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#8B95A1',
                  marginBottom: 10,
                  marginLeft: 4,
                }}>
                장소 이름
              </Text>

              <TextInput
                ref={nicknameInputRef}
                value={placeName}
                onChangeText={setPlaceName}
                placeholder="예) 본가, 친구 집, 헬스장"
                placeholderTextColor="#B0B8C1"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleConfirm}
                style={{
                  height: 58,
                  backgroundColor: '#F2F4F6',
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  fontSize: 17,
                  fontWeight: '500',
                  color: '#191F28',
                }}
              />
            </Animated.View>
          </View>

          {/* 확인 버튼 */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom:
                Platform.OS === 'ios' ? 34 : 24,
            }}>
            <Pressable
              onPress={handleConfirm}
              disabled={
                screen !== 'naming' ||
                !placeName.trim() ||
                isSubmitting
              }
              style={{
                width: '100%',
                height: 58,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  screen === 'naming' &&
                  placeName.trim()
                    ? '#191F28'
                    : '#F2F4F6',
              }}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color:
                      screen === 'naming' &&
                      placeName.trim()
                        ? '#FFFFFF'
                        : '#B0B8C1',
                  }}>
                  확인
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
  }