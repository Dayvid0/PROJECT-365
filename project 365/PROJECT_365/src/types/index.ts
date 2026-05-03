// ============================================================
// PROJECT_365 — Shared TypeScript types
// ============================================================

export type HabitStatus = 0 | 0.5 | 1;

export interface User {
  uid: string;
  displayName: string;
  email: string;
  timezone: string;
  createdAt: string;
  preferences: {
    theme: 'light' | 'dark';
    notificationTime: string; // "HH:mm"
  };
}

export type HabitCategory =
  | 'health'
  | 'learning'
  | 'mindset'
  | 'work'
  | 'routine'
  | 'other';

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  order: number;
  isActive: boolean;
  createdAt: string;
  color: string; // hex
}

export interface HabitLog {
  habitId: string;
  date: string; // YYYY-MM-DD
  status: HabitStatus;
  updatedAt: string;
}

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  completionRate: number;
  failureRate: number;
  bestHabit: { id: string; name: string; score: number } | null;
  worstHabit: { id: string; name: string; score: number } | null;
  habitScores: Record<string, number>;
  dailyScores: Record<string, number>; // YYYY-MM-DD -> score
  weeklyAverages: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
  generatedAt: string;
}

export interface StreakData {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
}

// Navigation param types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Grid: undefined;
  Analytics: undefined;
  Manager: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  HabitDetail: { habitId: string };
};
