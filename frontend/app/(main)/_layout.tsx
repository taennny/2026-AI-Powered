import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {router} from 'expo-router';

import {useAuthStore} from '@/store/authStore';

export default function MainLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return <Stack screenOptions={{headerShown: false}} />;
}
