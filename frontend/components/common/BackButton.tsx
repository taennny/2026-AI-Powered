import {Text, TouchableOpacity} from 'react-native';
import {useRouter} from 'expo-router';

export default function BackButton() {
  const router = useRouter();

  if (!router.canGoBack()) return null;

  return (
    <TouchableOpacity
      onPress={() => router.back()}
      hitSlop={12}
      className="absolute left-3 top-[52px] z-10 p-1"
    >
      <Text className="text-2xl font-normal text-muted">{'<'}</Text>
    </TouchableOpacity>
  );
}
