// ============================================================
// PROJECT_365 — Pure calculation utilities
// ============================================================

import { HabitLog, MonthlySnapshot, Habit, HabitStatus } from '../types';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getWeek,
  startOfWeek,
  isAfter,
  isBefore,
  parseISO,
  subDays,
} from 'date-fns';

export const STATUS = {
  COMPLETE: 1 as HabitStatus,
  PARTIAL: 0.5 as HabitStatus,
  MISSED: 0 as HabitStatus,
};

export const STATUS_CYCLE: HabitStatus[] = [1, 0.5, 0];

/** Cycle through status states: undefined/no-log → 1 → 0.5 → 0 → 1 */
export function cycleStatus(current: HabitStatus | undefined): HabitStatus {
  if (current === undefined || current === null) return 1;
  if (current === 1) return 0.5;
  if (current === 0.5) return 0;
  return 1;
}

/**
 * Habit completion % for a given set of logs.
 * Only days where a log exists are counted.
 */
export function habitCompletionRate(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  return logs.reduce((sum, l) => sum + l.status, 0) / logs.length;
}

/**
 * Daily score: average of all active habit statuses for that day.
 */
export function dailyScore(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  return logs.reduce((sum, l) => sum + l.status, 0) / logs.length;
}

/**
 * Weekly average: mean of daily scores in that week.
 */
export function weeklyAverage(dailyScores: number[]): number {
  if (!dailyScores.length) return 0;
  return dailyScores.reduce((a, b) => a + b, 0) / dailyScores.length;
}

/**
 * Monthly completion rate: mean of all habit completion rates.
 */
export function monthlyCompletionRate(habitRates: number[]): number {
  if (!habitRates.length) return 0;
  return habitRates.reduce((a, b) => a + b, 0) / habitRates.length;
}

/**
 * Current streak: consecutive days with status === 1 going back from today.
 */
export function currentStreak(
  logs: HabitLog[],
  today: Date = new Date()
): number {
  const logMap = new Map<string, HabitStatus>(
    logs.map((l) => [l.date, l.status])
  );

  let streak = 0;
  let cursor = today;

  while (true) {
    const key = format(cursor, 'yyyy-MM-dd');
    const status = logMap.get(key);
    if (status === 1) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Builds a MonthlySnapshot from raw habits and logs for a given month string "YYYY-MM".
 */
export function buildMonthlySnapshot(
  month: string,
  habits: Habit[],
  allLogs: HabitLog[]
): MonthlySnapshot {
  const [year, m] = month.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, m - 1));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter logs for this month
  const monthLogs = allLogs.filter((l) => l.date.startsWith(month));

  // Per-habit rates
  const habitScores: Record<string, number> = {};
  for (const habit of habits.filter((h) => h.isActive)) {
    const hLogs = monthLogs.filter((l) => l.habitId === habit.id);
    habitScores[habit.id] = habitCompletionRate(hLogs);
  }

  // Daily scores
  const dailyScoresMap: Record<string, number> = {};
  for (const day of daysInMonth) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayLogs = monthLogs.filter((l) => l.date === dateStr);
    if (dayLogs.length > 0) {
      dailyScoresMap[dateStr] = dailyScore(dayLogs);
    }
  }

  // Weekly averages (4 buckets by day-of-month)
  const weeks: Record<string, number[]> = {
    week1: [],
    week2: [],
    week3: [],
    week4: [],
  };
  for (const day of daysInMonth) {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dom = day.getDate(); // 1-31
    const weekKey =
      dom <= 7
        ? 'week1'
        : dom <= 14
        ? 'week2'
        : dom <= 21
        ? 'week3'
        : 'week4';
    if (dailyScoresMap[dateStr] !== undefined) {
      weeks[weekKey].push(dailyScoresMap[dateStr]);
    }
  }

  const weeklyAverages = {
    week1: weeklyAverage(weeks.week1),
    week2: weeklyAverage(weeks.week2),
    week3: weeklyAverage(weeks.week3),
    week4: weeklyAverage(weeks.week4),
  };

  const rates = Object.values(habitScores);
  const overallRate = monthlyCompletionRate(rates);

  // Best / worst habit
  let bestHabit = null;
  let worstHabit = null;
  const activeHabits = habits.filter((h) => h.isActive);
  if (activeHabits.length > 0) {
    let best = activeHabits[0];
    let worst = activeHabits[0];
    for (const h of activeHabits) {
      if ((habitScores[h.id] ?? 0) > (habitScores[best.id] ?? 0)) best = h;
      if ((habitScores[h.id] ?? 0) < (habitScores[worst.id] ?? 0)) worst = h;
    }
    bestHabit = {
      id: best.id,
      name: best.name,
      score: habitScores[best.id] ?? 0,
    };
    worstHabit = {
      id: worst.id,
      name: worst.name,
      score: habitScores[worst.id] ?? 0,
    };
  }

  return {
    month,
    completionRate: overallRate,
    failureRate: 1 - overallRate,
    bestHabit,
    worstHabit,
    habitScores,
    dailyScores: dailyScoresMap,
    weeklyAverages,
    generatedAt: new Date().toISOString(),
  };
}

/** Format a 0–1 ratio as a percentage string with 1 decimal (e.g. "72.7%") */
export function formatPercent(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

/** Get YYYY-MM string for a given Date */
export function toMonthString(date: Date): string {
  return format(date, 'yyyy-MM');
}

/** Get YYYY-MM-DD string for a given Date */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Get the 4-week day grid for a given month string "YYYY-MM" */
export function getMonthDayGrid(month: string): Date[][] {
  const [year, m] = month.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, m - 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weeks: Date[][] = [[], [], [], []];
  for (const day of days) {
    const dom = day.getDate();
    const weekIdx = dom <= 7 ? 0 : dom <= 14 ? 1 : dom <= 21 ? 2 : 3;
    weeks[weekIdx].push(day);
  }
  return weeks;
}
