import { describe, expect, it } from "vitest";
import {
  evaluateReminder,
  withinQuietHours,
  type ReminderSuppression,
} from "../reminders";
import type { HabitLog, HabitReminder } from "../types";

function reminder(overrides: Partial<HabitReminder> = {}): HabitReminder {
  return {
    id: "reminder-1",
    habitId: "habit-1",
    enabled: true,
    time: "09:00",
    weekdays: [],
    snoozeMinutes: 10,
    stopAfterCompletion: false,
    createdAt: "2026-03-02T00:00:00.000Z",
    ...overrides,
  };
}

function evaluate(overrides: Partial<Parameters<typeof evaluateReminder>[0]> = {}) {
  return evaluateReminder({
    reminder: reminder(),
    habitName: "Morning walk",
    now: new Date("2026-03-02T09:05:00.000Z"),
    date: "2026-03-02",
    timezone: "UTC",
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    logs: [],
    ...overrides,
  });
}

describe("withinQuietHours", () => {
  it("supports same-day and overnight windows", () => {
    expect(withinQuietHours(10 * 60, "09:00", "17:00")).toBe(true);
    expect(withinQuietHours(18 * 60, "09:00", "17:00")).toBe(false);
    expect(withinQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(withinQuietHours(3 * 60, "22:00", "07:00")).toBe(true);
    expect(withinQuietHours(12 * 60, "22:00", "07:00")).toBe(false);
  });

  it("treats equal start and end as no quiet window", () => {
    expect(withinQuietHours(12 * 60, "12:00", "12:00")).toBe(false);
  });
});

describe("evaluateReminder", () => {
  it("nudges only inside a transparent window after the scheduled time", () => {
    expect(evaluate().state).toBe("due");

    const early = evaluate({ now: new Date("2026-03-02T08:30:00.000Z") });
    expect(early.state).toBe("waiting");
    expect(early.nextDueMinutes).toBe(30);

    const late = evaluate({ now: new Date("2026-03-02T12:30:00.000Z") });
    expect(late.state).toBe("waiting");
    expect(late.nextDueMinutes).toBe(20 * 60 + 30);
  });

  it("respects weekday selection and quiet hours", () => {
    const tuesdayOnly = evaluate({
      reminder: reminder({ weekdays: [2] }),
      date: "2026-03-02", // Monday
    });
    expect(tuesdayOnly.state).toBe("wrong_day");

    const quiet = evaluate({
      now: new Date("2026-03-02T23:00:00.000Z"),
      reminder: reminder({ time: "23:00" }),
    });
    expect(quiet.state).toBe("quiet");
  });

  it("suppresses a completed habit when configured to stop", () => {
    const logs: HabitLog[] = [
      { habitId: "habit-1", date: "2026-03-02", status: 1, updatedAt: "2026-03-02T09:00:00.000Z" },
    ];
    expect(evaluate({ logs, reminder: reminder({ stopAfterCompletion: true }) }).state).toBe("complete");
    expect(evaluate({ logs }).state).toBe("due");
  });

  it("honors snooze and dismiss for the selected date only", () => {
    const now = new Date("2026-03-02T09:05:00.000Z");
    const snoozed: ReminderSuppression = {
      kind: "snooze",
      date: "2026-03-02",
      until: now.getTime() + 10 * 60_000,
    };
    const snoozeResult = evaluate({ now, suppression: snoozed });
    expect(snoozeResult.state).toBe("snoozed");
    expect(snoozeResult.nextDueMinutes).toBe(10);

    const dismissed: ReminderSuppression = {
      kind: "dismiss",
      date: "2026-03-02",
      until: now.getTime() + 60_000,
    };
    expect(evaluate({ now, suppression: dismissed }).state).toBe("dismissed");

    const stale: ReminderSuppression = {
      kind: "dismiss",
      date: "2026-03-01",
      until: now.getTime() + 60_000,
    };
    expect(evaluate({ now, suppression: stale }).state).toBe("due");

    const expired: ReminderSuppression = {
      kind: "snooze",
      date: "2026-03-02",
      until: now.getTime() - 60_000,
    };
    expect(evaluate({ now, suppression: expired }).state).toBe("due");
  });

  it("reports disabled reminders without exposing a due state", () => {
    const result = evaluate({ reminder: reminder({ enabled: false }) });
    expect(result.state).toBe("inactive");
    expect(result.nextDueMinutes).toBeNull();
  });
});
