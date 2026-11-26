import type {
  Habit,
  HabitLog,
  HabitSchedule,
  ProgressSummary,
  ScheduleException,
  WeeklyContextNote,
  WeeklyHabitReview,
  WeeklyReview,
} from "./types";
import { scheduledOpportunitiesForRange, summarizeOpportunities } from "./schedule";

const MAX_CONTEXT_NOTES = 8;

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Week starts on Monday. Date strings are calendar dates, so arithmetic stays UTC-based. */
export function weekStartFor(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return shiftDate(date, -daysSinceMonday);
}

export function shiftWeekStart(weekStart: string, weeks: number): string {
  return shiftDate(weekStart, weeks * 7);
}

export function weekEndFor(weekStart: string): string {
  return shiftDate(weekStart, 6);
}

function rateChange(current: ProgressSummary, previous: ProgressSummary): number | null {
  if (previous.scheduled === 0) return null;
  return (current.completionRate - previous.completionRate) * 100;
}

function contextNotesFor(
  logs: HabitLog[],
  habits: Habit[],
  start: string,
  end: string
): WeeklyContextNote[] {
  const names = new Map(habits.map((habit) => [habit.id, habit.name]));
  const latestByDay = new Map<string, HabitLog>();

  for (const log of logs) {
    if (log.date < start || log.date > end || !log.note?.trim()) continue;
    const key = `${log.habitId}|${log.date}`;
    const existing = latestByDay.get(key);
    const stamp = log.updatedAt ?? log.createdAt ?? "";
    const existingStamp = existing?.updatedAt ?? existing?.createdAt ?? "";
    if (!existing || stamp > existingStamp) latestByDay.set(key, log);
  }

  return [...latestByDay.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.habitId.localeCompare(b.habitId))
    .slice(0, MAX_CONTEXT_NOTES)
    .map((log) => ({
      habitId: log.habitId,
      habitName: names.get(log.habitId) ?? null,
      date: log.date,
      note: log.note!.trim(),
    }));
}

/**
 * Pure, private weekly review. Skips and planned breaks are already excluded by
 * schedule expansion; every comparison is against the same user's prior week.
 */
export function buildWeeklyReview(input: {
  weekStart: string;
  habits: Habit[];
  logs: HabitLog[];
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  note?: string | null;
  now?: Date;
}): WeeklyReview {
  const weekStart = weekStartFor(input.weekStart);
  const weekEnd = weekEndFor(weekStart);
  const previousWeekStart = shiftDate(weekStart, -7);
  const previousWeekEnd = shiftDate(weekStart, -1);

  const currentLogs = input.logs.filter(
    (log) => log.date >= weekStart && log.date <= weekEnd
  );
  const previousLogs = input.logs.filter(
    (log) => log.date >= previousWeekStart && log.date <= previousWeekEnd
  );

  const currentOpportunities = scheduledOpportunitiesForRange(
    input.schedules,
    input.exceptions,
    weekStart,
    weekEnd
  );
  const previousOpportunities = scheduledOpportunitiesForRange(
    input.schedules,
    input.exceptions,
    previousWeekStart,
    previousWeekEnd
  );

  const habitIds = [...new Set([
    ...currentOpportunities.map((item) => item.habitId),
    ...previousOpportunities.map((item) => item.habitId),
  ])];
  const habits = input.habits
    .filter((habit) => habitIds.includes(habit.id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const habitRows: WeeklyHabitReview[] = habits.map((habit) => {
    const current = summarizeOpportunities(
      currentLogs.filter((log) => log.habitId === habit.id),
      currentOpportunities.filter((item) => item.habitId === habit.id)
    );
    const previous = summarizeOpportunities(
      previousLogs.filter((log) => log.habitId === habit.id),
      previousOpportunities.filter((item) => item.habitId === habit.id)
    );
    return {
      habitId: habit.id,
      name: habit.name,
      color: habit.color,
      current,
      previous,
      delta: rateChange(current, previous),
    };
  });

  const current = summarizeOpportunities(currentLogs, currentOpportunities);
  const previous = summarizeOpportunities(previousLogs, previousOpportunities);

  return {
    weekStart,
    weekEnd,
    previousWeekStart,
    previousWeekEnd,
    current,
    previous,
    delta: rateChange(current, previous),
    habits: habitRows,
    contextNotes: contextNotesFor(input.logs, input.habits, weekStart, weekEnd),
    note: input.note?.trim() || null,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
