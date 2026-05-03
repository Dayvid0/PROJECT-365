// ============================================================
// PROJECT_365 — Navigation
// ============================================================

import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore, useThemeStore } from '../store';
import { DARK_THEME, LIGHT_THEME } from '../theme';

import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HabitGridScreen from '../screens/HabitGridScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import HabitManagerScreen from '../screens/HabitManagerScreen';
import SettingsScreen from '../screens/SettingsScreen';

import type { MainTabParamList, MainStackParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createStackNavigator();
const MainStack = createStackNavigator<MainStackParamList>();

// ── Tab icons ──────────────────────────────────────────────────
const TAB_ICONS: Record<string, string> = {
  Dashboard: '📊',
  Grid: '🗂',
  Analytics: '📈',
  Manager: '✅',
  Settings: '⚙️',
};

function TabIcon({
  name,
  focused,
  color: _color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICONS[name]}
    </Text>
  );
}

// ── Splash / loading screen ───────────────────────────────────
function SplashScreen() {
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  return <View style={{ flex: 1, backgroundColor: T.background }} />;
}

// ── Main tab navigator ────────────────────────────────────────
function MainTabs() {
  const { theme } = useThemeStore();
  const T = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: T.tabBarActive,
        tabBarInactiveTintColor: T.tabBarInactive,
        tabBarStyle: {
          backgroundColor: T.tabBar,
          borderTopColor: T.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: 4,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Grid" component={HabitGridScreen} options={{ title: 'Grid' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Stats' }} />
      <Tab.Screen name="Manager" component={HabitManagerScreen} options={{ title: 'Habits' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

// ── Authenticated main stack (tabs + modal detail) ────────────
function AuthenticatedStack() {
  return (
    <MainStack.Navigator id="main-stack" screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Tabs" component={MainTabs} />
      <MainStack.Screen
        name="HabitDetail"
        component={HabitDetailScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </MainStack.Navigator>
  );
}

// ── Root navigator ─────────────────────────────────────────────
export default function AppNavigator() {
  const { user, isLoading, hasCompletedOnboarding } = useAuthStore();
  const { theme } = useThemeStore();

  const navTheme =
    theme === 'dark'
      ? {
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: DARK_THEME.background,
            card: DARK_THEME.surface,
            text: DARK_THEME.text,
            border: DARK_THEME.border,
            primary: DARK_THEME.primary,
            notification: DARK_THEME.primary,
          },
        }
      : {
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: LIGHT_THEME.background,
            card: LIGHT_THEME.surface,
            text: LIGHT_THEME.text,
            border: LIGHT_THEME.border,
            primary: LIGHT_THEME.primary,
            notification: LIGHT_THEME.primary,
          },
        };

  // NavigationContainer is ALWAYS mounted so React Navigation can initialise
  // properly on every platform including web.
  // The single RootStack drives all state transitions without remounting.
  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator id="root" screenOptions={{ headerShown: false, animation: 'none' }}>
        {isLoading ? (
          // Blank branded screen while Firebase auth resolves
          <RootStack.Screen name="Splash" component={SplashScreen} />
        ) : !user ? (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        ) : !hasCompletedOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <RootStack.Screen name="App" component={AuthenticatedStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
