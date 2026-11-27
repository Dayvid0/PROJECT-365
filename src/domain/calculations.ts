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
  ScheduleException,
  HabitSchedule,
  ScheduledOpportunity,
  StreakPolicy,
  StreakSummary,
} from "./types";
import {
  scheduledOpportunitiesForRange,
  summarizeOpportunities,
} from "./schedule";

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

/** Legacy average over logged days. Pass scheduled dates for schedule-aware rates. */
export function habitCompletionRate(logs: HabitLog[], scheduledDates?: string[]): number {
  if (!scheduledDates) {
    if (!logs.length) return 0;
    return logs.reduce((sum, log) => sum + log.status, 0) / logs.length;
  }
  if (!scheduledDates.length) return 0;

  const byDate = new Map<string, HabitLog>();
  for (const log of logs) {
    const existing = byDate.get(log.date);
    if (!existing || log.status > existing.status) byDate.set(log.date, log);
  }
  const earned = scheduledDates.reduce(
    (sum, date) => sum + (byDate.get(date)?.status ?? 0),
    0
  );
  return earned / scheduledDates.length;
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

/** Count/value check-ins map onto the three-state status used by the grid. */
export function statusFromValue(habit: Habit, value: number | null | undefined): HabitStatus {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return STATUS.MISSED;
  }
  if (habit.kind === "count") {
    const target = habit.targetValue ?? 1;
    const ratio = value / target;
    return ratio >= 1 ? STATUS.COMPLETE : STATUS.PARTIAL;
  }
  if (habit.kind === "timer") {
    const target = habit.targetDurationSeconds ?? 1;
    const ratio = value / target;
    return ratio >= 1 ? STATUS.COMPLETE : STATUS.PARTIAL;
  }
  return STATUS.COMPLETE;
}

export function resolveStatus(
  habit: Habit,
  status: HabitStatus | undefined,
  value: number | null | undefined
): HabitStatus {
  return status ?? statusFromValue(habit, value);
}

function statusByDate(logs: HabitLog[]): Map<string, HabitStatus> {
  const statuses = new Map<string, HabitStatus>();
  for (const log of logs) {
    const current = statuses.get(log.date);
    if (current === undefined || log.status > current) statuses.set(log.date, log.status);
  }
  return statuses;
}

/** Consecutive eligible days ending today (or the supplied day). */
export function currentStreak(
  logs: HabitLog[],
  today: Date = new Date(),
  scheduledDates?: string[]
): number {
  const statuses = statusByDate(logs);

  if (scheduledDates?.length) {
    const todayKey = format(today, "yyyy-MM-dd");
    const eligible = [...new Set(scheduledDates)]
      .filter((date) => date <= todayKey)
      .sort()
      .reverse();
    let streak = 0;
    for (const date of eligible) {
      if (statuses.get(date) !== 1) break;
      streak += 1;
    }
    return streak;
  }

  let streak = 0;
  let cursor = today;
  while (true) {
    if (statuses.get(format(cursor, "yyyy-MM-dd")) !== 1) break;
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Longest run of fully-complete eligible days. */
export function longestStreak(logs: HabitLog[], scheduledDates?: string[]): number {
  const statuses = statusByDate(logs);

  if (scheduledDates?.length) {
    const eligible = [...new Set(scheduledDates)].sort();
    let longest = 0;
    let run = 0;
    for (const date of eligible) {
      if (statuses.get(date) === 1) {
        run += 1;
        longest = Math.max(longest, run);
      } else {
        run = 0;
      }
    }
    return longest;
  }

  const dates = [...statuses.entries()]
    .filter(([, status]) => status === 1)
    .map(([date]) => date)
    .sort();
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

/**
 * Streak presentation is a user choice, not an implicit judgment. "target"
 * measures consistency across recent scheduled opportunities; "off" hides
 * streaks while keeping all completion history intact.
 */
export function streakSummary(
  logs: HabitLog[],
  scheduledDates: string[],
  policy: StreakPolicy,
  today: Date = new Date()
): StreakSummary {
  if (policy === "off") {
    return { current: 0, best: 0, visible: false, label: "Streaks hidden" };
  }

  if (policy === "target") {
    const dates = [...new Set(scheduledDates)].filter((date) => date <= format(today, "yyyy-MM-dd")).sort();
    const statuses = statusByDate(logs);
    const complete = (date: string) => statuses.get(date) === 1;
    const window = Math.min(7, dates.length);
    const current = dates.slice(-window).filter(complete).length;
    let best = 0;
    for (let index = 0; index <= dates.length - window; index += 1) {
      best = Math.max(best, dates.slice(index, index + window).filter(complete).length);
    }
    return {
      current,
      best,
      visible: true,
      label: `Complete days in the last ${window} scheduled opportunities`,
    };
  }

  return {
    current: currentStreak(logs, today, scheduledDates),
    best: longestStreak(logs, scheduledDates),
    visible: true,
    label: "Consecutive scheduled days",
  };
}

export interface SnapshotOptions {
  schedules?: HabitSchedule[];
  exceptions?: ScheduleException[];
}

/** Build the persisted monthly analytics snapshot from raw habits and logs. */
export function buildMonthlySnapshot(
  month: string,
  habits: Habit[],
  allLogs: HabitLog[],
  generatedAt: Date = new Date(),
  options: SnapshotOptions = {}
): MonthlySnapshot {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) throw new Error(`Invalid month: ${month}`);

  const monthStart = startOfMonth(new Date(year, monthNumber - 1));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
  const monthLogs = allLogs.filter((log) => log.date.startsWith(month));
  const activeHabits = habits.filter((habit) => habit.isActive);
  const schedules = options.schedules ?? [];
  const exceptions = options.exceptions ?? [];
  const start = `${month}-01`;
  const end = `${month}-31`;

  // Without schedule data, fall back to the legacy logged-day denominator so old
  // cached snapshots remain readable. New writes always supply schedule versions.
  const opportunities: ScheduledOpportunity[] = schedules.length
    ? scheduledOpportunitiesForRange(schedules, exceptions, start, end)
    : monthLogs.map((log) => ({
        habitId: log.habitId,
        date: log.date,
        occurrence: log.occurrence ?? 1,
        scheduleId: "legacy",
      }));

  const opportunitiesByHabit = new Map<string, ScheduledOpportunity[]>();
  const opportunitiesByDate = new Map<string, ScheduledOpportunity[]>();
  for (const opportunity of opportunities) {
    const habitList = opportunitiesByHabit.get(opportunity.habitId) ?? [];
    habitList.push(opportunity);
    opportunitiesByHabit.set(opportunity.habitId, habitList);
    const dayList = opportunitiesByDate.get(opportunity.date) ?? [];
    dayList.push(opportunity);
    opportunitiesByDate.set(opportunity.date, dayList);
  }

  const habitScores: Record<string, number> = {};
  const scheduledOpportunities: Record<string, number> = {};
  for (const habit of activeHabits) {
    const habitOpportunities = opportunitiesByHabit.get(habit.id) ?? [];
    const summary = summarizeOpportunities(
      monthLogs.filter((log) => log.habitId === habit.id),
      habitOpportunities
    );
    habitScores[habit.id] = summary.completionRate;
    scheduledOpportunities[habit.id] = summary.scheduled;
  }

  const dailyScores: Record<string, number> = {};
  const weeks: Record<string, number[]> = { week1: [], week2: [], week3: [], week4: [] };

  for (const day of daysInMonth) {
    const date = format(day, "yyyy-MM-dd");
    const scheduled = opportunitiesByDate.get(date) ?? [];
    if (!scheduled.length) continue;

    const dayLogs = monthLogs.filter((log) => log.date === date);
    const score = summarizeOpportunities(dayLogs, scheduled).completionRate;
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

  // Habits with no schedule in this month are not tracked here; averaging them
  // in as 0% would penalise months for habits that did not exist yet.
  const scoredHabits = activeHabits.filter(
    (habit) => (scheduledOpportunities[habit.id] ?? 0) > 0
  );
  const completionRate = monthlyCompletionRate(scoredHabits.map((habit) => habitScores[habit.id] ?? 0));
  let bestHabit: MonthlySnapshot["bestHabit"] = null;
  let worstHabit: MonthlySnapshot["worstHabit"] = null;

  if (scoredHabits.length > 0) {
    const ranked = [...scoredHabits].sort(
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
    scheduledOpportunities,
    calculationVersion: 2,
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

export function logKey(
  log: Pick<HabitLog, "date" | "habitId" | "occurrence">
): string {
  return `${log.date}_${log.habitId}_${log.occurrence ?? 1}`;
}

export function dedupeLogs(logs: HabitLog[]): HabitLog[] {
  const byKey = new Map<string, HabitLog>();
  for (const log of logs) byKey.set(logKey(log), log);
  return [...byKey.values()];
}

// Re-exported so callers can use range helpers without importing date-fns directly.
export { isAfter, isBefore };
