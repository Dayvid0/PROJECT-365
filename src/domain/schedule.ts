import type {
  HabitLog,
  HabitSchedule,
  ProgressSummary,
  ScheduleException,
  ScheduledOpportunity,
} from "./types";

const MS_PER_DAY = 86_400_000;

/** UTC-based date-key helpers keep calendar dates independent of server timezone. */
export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Invalid date: ${key}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${key}`);
  }
  return { year, month, day };
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(key: string, amount: number): string {
  const { year, month, day } = parseDateKey(key);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return formatDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  const aTime = Date.UTC(a.year, a.month - 1, a.day);
  const bTime = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bTime - aTime) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Clamp a target day (e.g. 31) into months that are shorter. */
export function monthDayFor(year: number, month: number, preferred: number): number {
  return Math.min(Math.max(1, preferred), daysInMonth(year, month));
}

/** Resolve the schedule version that governed a local calendar date. */
export function scheduleVersionForDate(
  schedules: HabitSchedule[],
  date: string
): HabitSchedule | undefined {
  return schedules
    .filter(
      (schedule) =>
        schedule.effectiveFrom <= date &&
        (schedule.effectiveTo === null || date <= schedule.effectiveTo)
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0];
}

export function isExceptionDate(exceptions: ScheduleException[], date: string): boolean {
  return exceptions.some(
    (exception) => exception.startDate <= date && date <= exception.endDate
  );
}

/** Which local date does an instant belong to, given the habit's day boundary? */
export function localDateForInstant(
  instant: string | Date,
  timezone: string,
  dayStartMinute = 0
): string {
  const timestamp = typeof instant === "string" ? new Date(instant).getTime() : instant.getTime();
  if (Number.isNaN(timestamp)) throw new Error(`Invalid instant: ${String(instant)}`);

  const shifted = new Date(timestamp - dayStartMinute * 60_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error(`Invalid timezone: ${timezone}`);
  return `${year}-${month}-${day}`;
}

function isScheduledDate(schedule: HabitSchedule, date: string): boolean {
  const { year, month, day } = parseDateKey(date);

  switch (schedule.cadence) {
    case "daily":
      return true;
    case "weekly": {
      if (schedule.weekdays.length > 0) {
        return schedule.weekdays.includes(weekdayOf(date));
      }
      const timesPerWeek = schedule.timesPerWeek ?? 7;
      const anchor = schedule.anchorDate || schedule.effectiveFrom;
      const anchorWeekday = weekdayOf(anchor);
      return ((weekdayOf(date) - anchorWeekday + 7) % 7) < timesPerWeek;
    }
    case "interval": {
      const interval = schedule.intervalDays ?? 1;
      if (interval < 1) return false;
      const distance = daysBetween(schedule.anchorDate || schedule.effectiveFrom, date);
      return distance >= 0 && distance % interval === 0;
    }
    case "monthly": {
      const preferred = schedule.monthDay ?? 1;
      return day === monthDayFor(year, month, preferred);
    }
    default:
      return false;
  }
}

/** Expand versioned schedules into concrete opportunities, excluding skips/breaks. */
export function scheduledOpportunitiesForRange(
  schedules: HabitSchedule[],
  exceptions: ScheduleException[],
  start: string,
  end: string,
  habitId?: string
): ScheduledOpportunity[] {
  const relevantSchedules = habitId
    ? schedules.filter((schedule) => schedule.habitId === habitId)
    : schedules;
  if (!relevantSchedules.length || start > end) return [];

  const byHabit = new Map<string, HabitSchedule[]>();
  for (const schedule of relevantSchedules) {
    const list = byHabit.get(schedule.habitId) ?? [];
    list.push(schedule);
    byHabit.set(schedule.habitId, list);
  }

  const opportunities: ScheduledOpportunity[] = [];
  // Guard against an accidentally unbounded request.
  const maxDays = 366 * 10;
  for (const [habitKey, habitSchedules] of byHabit) {
    const habitExceptions = exceptions.filter((exception) => exception.habitId === habitKey);
    let cursor = start;
    for (let index = 0; index <= maxDays && cursor <= end; index += 1) {
      const schedule = scheduleVersionForDate(habitSchedules, cursor);
      if (
        schedule &&
        isScheduledDate(schedule, cursor) &&
        !isExceptionDate(habitExceptions, cursor)
      ) {
        for (let occurrence = 1; occurrence <= Math.max(1, schedule.timesPerDay); occurrence += 1) {
          opportunities.push({
            habitId: habitKey,
            date: cursor,
            occurrence,
            scheduleId: schedule.id,
          });
        }
      }
      cursor = addDays(cursor, 1);
    }
  }
  return opportunities;
}

export function scheduledDatesForRange(
  schedules: HabitSchedule[],
  exceptions: ScheduleException[],
  start: string,
  end: string,
  habitId: string
): string[] {
  return scheduledOpportunitiesForRange(schedules, exceptions, start, end, habitId).map(
    (opportunity) => opportunity.date
  );
}

export function emptyProgressSummary(): ProgressSummary {
  return { scheduled: 0, completed: 0, partial: 0, missed: 0, completionRate: 0 };
}

/** Score logs against scheduled opportunities rather than against logged days only. */
export function summarizeOpportunities(
  logs: HabitLog[],
  opportunities: ScheduledOpportunity[]
): ProgressSummary {
  if (!opportunities.length) return emptyProgressSummary();

  const byKey = new Map(
    logs.map((log) => [`${log.habitId}|${log.date}|${log.occurrence ?? 1}`, log])
  );
  let completed = 0;
  let partial = 0;
  let missed = 0;
  let earned = 0;

  for (const opportunity of opportunities) {
    const log = byKey.get(
      `${opportunity.habitId}|${opportunity.date}|${opportunity.occurrence}`
    );
    const status = log?.status ?? 0;
    earned += status;
    if (status === 1) completed += 1;
    else if (status === 0.5) partial += 1;
    else missed += 1;
  }

  return {
    scheduled: opportunities.length,
    completed,
    partial,
    missed,
    completionRate: earned / opportunities.length,
  };
}
