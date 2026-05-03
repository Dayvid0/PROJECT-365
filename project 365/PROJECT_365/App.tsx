// ============================================================
// PROJECT_365 — App Entry Point
// ============================================================

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import * as Notifications from 'expo-notifications';

import { auth } from './src/services/firebase';
import { getUser } from './src/services/firestore';
import { useAuthStore, useThemeStore } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export default function App() {
  const { setUser, setLoading } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    // Safety net: if Firebase never responds within 8 s, unblock the UI
    const timeout = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        console.warn('[Auth] Timeout — forcing loading=false');
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      setLoading(true);
      try {
        if (firebaseUser) {
          const profile = await getUser(firebaseUser.uid);
          setUser(
            profile ?? {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName ?? 'User',
              email: firebaseUser.email ?? '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              createdAt: new Date().toISOString(),
              preferences: { theme: 'dark', notificationTime: '08:00' },
            }
          );
        } else {
          setUser(null);
        }
      } catch (err) {
        console.warn('[Auth] Error:', err);
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName ?? 'User',
            email: firebaseUser.email ?? '',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            createdAt: new Date().toISOString(),
            preferences: { theme: 'dark', notificationTime: '08:00' },
          });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
