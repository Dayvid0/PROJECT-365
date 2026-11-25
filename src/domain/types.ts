// PROJECT-365 web — domain types. Kept framework-agnostic on purpose.

export type HabitStatus = 0 | 0.5 | 1;

export type HabitCategory =
  | "health"
  | "learning"
  | "mindset"
  | "work"
  | "routine"
  | "other";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  timezone: string;
  theme: "light" | "dark";
  notificationTime: string;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  category: HabitCategory;
  order: number;
  isActive: boolean;
  createdAt: string;
  color: string;
}

export interface HabitLog {
  habitId: string;
  date: string;
  status: HabitStatus;
  updatedAt: string;
}

export interface MonthlySnapshot {
  month: string;
  completionRate: number;
  failureRate: number;
  bestHabit: { id: string; name: string; score: number } | null;
  worstHabit: { id: string; name: string; score: number } | null;
  habitScores: Record<string, number>;
  dailyScores: Record<string, number>;
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

export interface BootstrapData {
  user: UserProfile;
  habits: Habit[];
  pendingLogCount: number;
}

export interface AnalyticsRangeData {
  habits: Habit[];
  logs: HabitLog[];
  months: string[];
}
