// PROJECT-365 web — domain types. Kept framework-agnostic on purpose.

export type HabitStatus = 0 | 0.5 | 1;

export type HabitCategory =
  | "health"
  | "learning"
  | "mindset"
  | "work"
  | "routine"
  | "other";

export type HabitKind = "check_in" | "count" | "timer";

export type CadenceKind = "daily" | "weekly" | "interval" | "monthly";

export type CheckInSource = "manual" | "import" | "timer" | "system";

export type ScheduleExceptionKind = "skip" | "planned_break";

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
  description: string | null;
  category: HabitCategory;
  order: number;
  isActive: boolean;
  createdAt: string;
  color: string;
  kind: HabitKind;
  targetValue: number | null;
  unit: string | null;
  targetDurationSeconds: number | null;
}

/** An immutable cadence version. Prior versions stay attached to historical dates. */
export interface HabitSchedule {
  id: string;
  habitId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  cadence: CadenceKind;
  /** 0 = Sunday … 6 = Saturday. Used by weekly schedules with explicit days. */
  weekdays: number[];
  /** Used when a weekly schedule has no explicit weekdays. */
  timesPerWeek: number | null;
  intervalDays: number | null;
  monthDay: number | null;
  timesPerDay: number;
  targetValue: number | null;
  unit: string | null;
  targetDurationSeconds: number | null;
  dayStartMinute: number;
  timezone: string;
  anchorDate: string;
  createdAt: string;
}

/** A skipped opportunity or planned break is not the same as a missed check-in. */
export interface ScheduleException {
  id: string;
  habitId: string;
  startDate: string;
  endDate: string;
  kind: ScheduleExceptionKind;
  reason: string | null;
  createdAt: string;
}

export interface HabitLog {
  habitId: string;
  date: string;
  status: HabitStatus;
  updatedAt: string;
  occurrence?: number;
  value?: number | null;
  unit?: string | null;
  note?: string | null;
  source?: CheckInSource;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string;
  editedAt?: string | null;
}

export interface ScheduledOpportunity {
  habitId: string;
  date: string;
  occurrence: number;
  scheduleId: string;
}

export interface ProgressSummary {
  scheduled: number;
  completed: number;
  partial: number;
  missed: number;
  completionRate: number;
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
  /** Scheduled opportunities per habit, after skips and planned breaks. */
  scheduledOpportunities?: Record<string, number>;
  calculationVersion?: number;
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
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  pendingLogCount: number;
}

export interface AnalyticsRangeData {
  habits: Habit[];
  logs: HabitLog[];
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  months: string[];
}
