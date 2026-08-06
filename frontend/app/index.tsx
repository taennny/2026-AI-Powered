import {useEffect} from 'react';
import {useRouter} from 'expo-router';
import {View, ActivityIndicator} from 'react-native';

import {useBootstrap} from '@/hooks/useBootstrap';

export default function IndexScreen() {
  const router = useRouter();
  const route = useBootstrap();

  useEffect(() => {
    if (route) {
      router.replace(route);
    }
  }, [route, router]);

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" />
    </View>
  );
}
