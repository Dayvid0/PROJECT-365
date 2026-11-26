import { weekdayOf } from "./schedule";
import type { HabitLog, HabitReminder } from "./types";

export const REMINDER_WINDOW_MINUTES = 120;
const MINUTES_PER_DAY = 24 * 60;

export type ReminderState =
  | "due"
  | "waiting"
  | "snoozed"
  | "dismissed"
  | "quiet"
  | "complete"
  | "wrong_day"
  | "inactive";

export interface ReminderSuppression {
  kind: "snooze" | "dismiss";
  /** Calendar date the suppression belongs to. */
  date: string;
  /** Epoch milliseconds until which the nudge is held back. */
  until: number;
}

export interface ReminderStatus {
  id: string;
  habitId: string;
  habitName: string;
  time: string;
  state: ReminderState;
  detail: string;
  /** Minutes until this nudge could next appear, when meaningful. */
  nextDueMinutes: number | null;
}

export function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** Inclusive start, exclusive end; overnight ranges are supported. */
export function withinQuietHours(minutes: number, start: string, end: string): boolean {
  const from = minuteOfDay(start);
  const until = minuteOfDay(end);
  if (from === until) return false;
  if (from < until) return minutes >= from && minutes < until;
  return minutes >= from || minutes < until;
}

export function clockFor(date: Date, timezone: string): { minutes: number; label: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
    return { minutes: Number(hour) * 60 + Number(minute), label: `${hour}:${minute}` };
  } catch {
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    return { minutes: date.getUTCHours() * 60 + date.getUTCMinutes(), label: `${hour}:${minute}` };
  }
}

function minutesUntil(ms: number, now: Date): number {
  return Math.max(0, Math.round((ms - now.getTime()) / 60_000));
}

/** End of the selected calendar day, approximated from the in-app clock. */
export function endOfLocalDay(now: Date, timezone: string): number {
  const { minutes } = clockFor(now, timezone);
  return now.getTime() + (MINUTES_PER_DAY - minutes) * 60_000;
}

function status(
  reminder: HabitReminder,
  habitName: string,
  state: ReminderState,
  detail: string,
  nextDueMinutes: number | null
): ReminderStatus {
  return {
    id: reminder.id,
    habitId: reminder.habitId,
    habitName,
    time: reminder.time,
    state,
    detail,
    nextDueMinutes,
  };
}

/**
 * Pure evaluation of one in-app nudge. Suppressions are session-only so the UI
 * never implies a delivery guarantee it cannot make on the web.
 */
export function evaluateReminder(input: {
  reminder: HabitReminder;
  habitName: string;
  now: Date;
  date: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  logs: HabitLog[];
  suppression?: ReminderSuppression;
  windowMinutes?: number;
}): ReminderStatus {
  const { reminder, now } = input;
  if (!reminder.enabled) {
    return status(reminder, input.habitName, "inactive", "Reminder is off.", null);
  }
  if (reminder.weekdays.length > 0 && !reminder.weekdays.includes(weekdayOf(input.date))) {
    return status(reminder, input.habitName, "wrong_day", "Not scheduled for this day.", null);
  }

  const completed = input.logs.some(
    (log) =>
      log.habitId === reminder.habitId &&
      log.date === input.date &&
      (log.status ?? 0) >= 1
  );
  if (reminder.stopAfterCompletion && completed) {
    return status(reminder, input.habitName, "complete", "Already checked in — no nudge needed.", null);
  }

  const clock = clockFor(now, input.timezone);
  const scheduled = minuteOfDay(reminder.time);
  const window = input.windowMinutes ?? REMINDER_WINDOW_MINUTES;
  const nextToday = scheduled - clock.minutes;
  const nextDueMinutes = nextToday > 0 ? nextToday : MINUTES_PER_DAY + nextToday;

  if (withinQuietHours(clock.minutes, input.quietHoursStart, input.quietHoursEnd)) {
    return status(reminder, input.habitName, "quiet", "Quiet hours are active.", null);
  }

  const suppression = input.suppression;
  if (suppression && suppression.date === input.date && now.getTime() < suppression.until) {
    const remaining = minutesUntil(suppression.until, now);
    return suppression.kind === "snooze"
      ? status(reminder, input.habitName, "snoozed", `Snoozed for ${remaining} more minutes.`, remaining)
      : status(reminder, input.habitName, "dismissed", "Dismissed for today.", null);
  }

  if (clock.minutes >= scheduled && clock.minutes - scheduled <= window) {
    return status(reminder, input.habitName, "due", `Scheduled for ${reminder.time}.`, null);
  }

  return status(
    reminder,
    input.habitName,
    "waiting",
    `Next nudge window at ${reminder.time}.`,
    nextDueMinutes
  );
}
