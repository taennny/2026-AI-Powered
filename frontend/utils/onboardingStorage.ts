import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_DONE_KEY = 'onboarding_done';

export async function isOnboardingDone() {
  return (await AsyncStorage.getItem(ONBOARDING_DONE_KEY)) !== null;
}

export async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
}
const PLACE_REGISTRATION_DONE_KEY = 'place_registration_done';

export async function isPlaceRegistrationDone() {
  return (await AsyncStorage.getItem(PLACE_REGISTRATION_DONE_KEY)) !== null;
}

export async function markPlaceRegistrationDone() {
  await AsyncStorage.setItem(PLACE_REGISTRATION_DONE_KEY, 'true');
}