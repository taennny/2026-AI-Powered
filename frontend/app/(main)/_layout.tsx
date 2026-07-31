import {useEffect} from 'react';
import {Stack} from 'expo-router';
import {router} from 'expo-router';

import {useAuthStore} from '@/store/authStore';
import {useLocationPermissionGuard} from '@/hooks/usePermissions';

export default function MainLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useLocationPermissionGuard();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return <Stack screenOptions={{headerShown: false}} />;
}
