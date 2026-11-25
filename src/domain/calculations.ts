import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfMonth,
  subDays,
} from "date-fns";
import type {
  Habit,
  HabitLog,
  HabitStatus,
  MonthlySnapshot,
} from "./types";

export const STATUS = {
  COMPLETE: 1 as HabitStatus,
  PARTIAL: 0.5 as HabitStatus,
  MISSED: 0 as HabitStatus,
};

export const STATUS_CYCLE: readonly HabitStatus[] = [1, 0.5, 0];

/** undefined/no-log → 1 → 0.5 → 0 → 1 */
export function cycleStatus(current: HabitStatus | undefined): HabitStatus {
  if (current === undefined || current === null) return 1;
  if (current === 1) return 0.5;
  if (current === 0.5) return 0;
  return 1;
}

/** Only days with a log are counted. */
export function habitCompletionRate(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  return logs.reduce((sum, log) => sum + log.status, 0) / logs.length;
}

export function dailyScore(logs: HabitLog[]): number {
  if (!logs.length) return 0;
  return logs.reduce((sum, log) => sum + log.status, 0) / logs.length;
}

export function weeklyAverage(dailyScores: number[]): number {
  if (!dailyScores.length) return 0;
  return dailyScores.reduce((sum, score) => sum + score, 0) / dailyScores.length;
}

export function monthlyCompletionRate(habitRates: number[]): number {
  if (!habitRates.length) return 0;
  return habitRates.reduce((sum, rate) => sum + rate, 0) / habitRates.length;
}

/** Consecutive fully-complete days ending today (or the supplied day). */
export function currentStreak(
  logs: HabitLog[],
  today: Date = new Date()
): number {
  const statuses = new Map(logs.map((log) => [log.date, log.status]));
  let streak = 0;
  let cursor = today;

  while (true) {
    if (statuses.get(format(cursor, "yyyy-MM-dd")) !== 1) break;
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Longest run of fully-complete days in chronological log order. */
export function longestStreak(logs: HabitLog[]): number {
  const dates = [...new Set(logs.filter((log) => log.status === 1).map((log) => log.date))].sort();
  let longest = 0;
  let run = 0;
  let previous: Date | null = null;

  for (const date of dates) {
    const current = new Date(`${date}T00:00:00Z`);
    const consecutive =
      previous !== null &&
      Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1;
    run = consecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = current;
  }
  return longest;
}

/** Build the persisted monthly analytics snapshot from raw habits and logs. */
export function buildMonthlySnapshot(
  month: string,
  habits: Habit[],
  allLogs: HabitLog[],
  generatedAt: Date = new Date()
): MonthlySnapshot {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) throw new Error(`Invalid month: ${month}`);

  const monthStart = startOfMonth(new Date(year, monthNumber - 1));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
  const monthLogs = allLogs.filter((log) => log.date.startsWith(month));
  const activeHabits = habits.filter((habit) => habit.isActive);

  const habitScores: Record<string, number> = {};
  for (const habit of activeHabits) {
    habitScores[habit.id] = habitCompletionRate(
      monthLogs.filter((log) => log.habitId === habit.id)
    );
  }

  const dailyScores: Record<string, number> = {};
  const weeks: Record<string, number[]> = { week1: [], week2: [], week3: [], week4: [] };

  for (const day of daysInMonth) {
    const date = format(day, "yyyy-MM-dd");
    const dayLogs = monthLogs.filter((log) => log.date === date);
    if (!dayLogs.length) continue;

    const score = dailyScore(dayLogs);
    dailyScores[date] = score;
    const dayOfMonth = day.getDate();
    const weekKey =
      dayOfMonth <= 7 ? "week1" : dayOfMonth <= 14 ? "week2" : dayOfMonth <= 21 ? "week3" : "week4";
    weeks[weekKey]!.push(score);
  }

  const weeklyAverages = {
    week1: weeklyAverage(weeks.week1!),
    week2: weeklyAverage(weeks.week2!),
    week3: weeklyAverage(weeks.week3!),
    week4: weeklyAverage(weeks.week4!),
  };

  const completionRate = monthlyCompletionRate(Object.values(habitScores));
  let bestHabit: MonthlySnapshot["bestHabit"] = null;
  let worstHabit: MonthlySnapshot["worstHabit"] = null;

  if (activeHabits.length > 0) {
    const ranked = [...activeHabits].sort(
      (a, b) => (habitScores[b.id] ?? 0) - (habitScores[a.id] ?? 0)
    );
    const best = ranked[0]!;
    const worst = ranked[ranked.length - 1]!;
    bestHabit = { id: best.id, name: best.name, score: habitScores[best.id] ?? 0 };
    worstHabit = { id: worst.id, name: worst.name, score: habitScores[worst.id] ?? 0 };
  }

  return {
    month,
    completionRate,
    failureRate: 1 - completionRate,
    bestHabit,
    worstHabit,
    habitScores,
    dailyScores,
    weeklyAverages,
    generatedAt: generatedAt.toISOString(),
  };
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function toMonthString(date: Date): string {
  return format(date, "yyyy-MM");
}

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Four fixed seven-day buckets matching the original 1–7 / 8–14 / 15–21 / 22–31 grid. */
export function getMonthDayGrid(month: string): Date[][] {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [[], [], [], []];

  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, monthNumber - 1)),
    end: endOfMonth(new Date(year, monthNumber - 1)),
  });
  const weeks: Date[][] = [[], [], [], []];
  for (const day of days) {
    const index = day.getDate() <= 7 ? 0 : day.getDate() <= 14 ? 1 : day.getDate() <= 21 ? 2 : 3;
    weeks[index]!.push(day);
  }
  return weeks;
}

export function shiftMonth(month: string, amount: number): string {
  const { year, monthNumber } = parseMonth(month);
  return toMonthString(new Date(year, monthNumber - 1 + amount, 1));
}

export function isDateInMonth(date: string, month: string): boolean {
  return date.startsWith(`${month}-`);
}

export function parseMonth(month: string): { year: number; monthNumber: number } {
  const parts = month.split("-").map(Number);
  const year = parts[0];
  const monthNumber = parts[1];
  if (year === undefined || monthNumber === undefined) {
    throw new Error(`Invalid month: ${month}`);
  }
  return { year, monthNumber };
}

export function logKey(log: Pick<HabitLog, "date" | "habitId">): string {
  return `${log.date}_${log.habitId}`;
}

export function dedupeLogs(logs: HabitLog[]): HabitLog[] {
  const byKey = new Map<string, HabitLog>();
  for (const log of logs) byKey.set(logKey(log), log);
  return [...byKey.values()];
}

// Re-exported so callers can use range helpers without importing date-fns directly.
export { isAfter, isBefore };
