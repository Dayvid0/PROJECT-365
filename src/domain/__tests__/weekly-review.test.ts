import { describe, expect, it } from "vitest";
import { buildWeeklyReview, weekStartFor } from "../weekly-review";
import type {
  Habit,
  HabitLog,
  HabitSchedule,
  ScheduleException,
} from "../types";

function habit(id: string, name: string, order: number): Habit {
  return {
    id,
    name,
    description: null,
    category: "other",
    order,
    isActive: true,
    createdAt: "2026-02-01T00:00:00.000Z",
    color: "#7C5CFC",
    kind: "check_in",
    targetValue: null,
    unit: null,
    targetDurationSeconds: null,
  };
}

function schedule(
  id: string,
  habitId: string,
  effectiveFrom: string,
  effectiveTo: string | null = null
): HabitSchedule {
  return {
    id,
    habitId,
    version: 1,
    effectiveFrom,
    effectiveTo,
    cadence: "daily",
    weekdays: [],
    timesPerWeek: null,
    intervalDays: null,
    monthDay: null,
    timesPerDay: 1,
    targetValue: null,
    unit: null,
    targetDurationSeconds: null,
    dayStartMinute: 0,
    timezone: "UTC",
    anchorDate: effectiveFrom,
    createdAt: "2026-02-01T00:00:00.000Z",
  };
}

function log(
  habitId: string,
  date: string,
  status: HabitLog["status"],
  note?: string
): HabitLog {
  return {
    habitId,
    date,
    status,
    updatedAt: `${date}T12:00:00.000Z`,
    note: note ?? null,
  };
}

const habitA = habit("habit-a", "Morning walk", 0);
const habitB = habit("habit-b", "Evening reading", 1);
const schedules = [
  schedule("schedule-a", habitA.id, "2026-02-01"),
  schedule("schedule-b", habitB.id, "2026-03-02"),
];
const exceptions: ScheduleException[] = [
  {
    id: "skip-a",
    habitId: habitA.id,
    startDate: "2026-03-04",
    endDate: "2026-03-04",
    kind: "skip",
    reason: "Travel day",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];
const logs = [
  log(habitA.id, "2026-02-23", 1),
  log(habitA.id, "2026-02-24", 1),
  log(habitA.id, "2026-02-25", 1),
  log(habitA.id, "2026-02-26", 1),
  log(habitA.id, "2026-02-27", 1),
  log(habitA.id, "2026-03-02", 1),
  log(habitA.id, "2026-03-03", 0.5, "Low energy — kept it short"),
  log(habitA.id, "2026-03-05", 1),
  log(habitB.id, "2026-03-06", 1, "Finished a chapter"),
];

describe("weekStartFor", () => {
  it("uses Monday as the start of the week", () => {
    expect(weekStartFor("2026-03-08")).toBe("2026-03-02");
    expect(weekStartFor("2026-03-02")).toBe("2026-03-02");
  });
});

describe("buildWeeklyReview", () => {
  const review = buildWeeklyReview({
    weekStart: "2026-03-04",
    habits: [habitA, habitB],
    logs,
    schedules,
    exceptions,
    note: "  Keep the week small.  ",
    now: new Date("2026-03-08T09:00:00.000Z"),
  });

  it("scores scheduled opportunities, excluding skips and planned breaks", () => {
    expect(review.weekStart).toBe("2026-03-02");
    expect(review.weekEnd).toBe("2026-03-08");
    expect(review.current.scheduled).toBe(13);
    expect(review.current.completed).toBe(3);
    expect(review.current.partial).toBe(1);
    expect(review.current.missed).toBe(9);
    expect(review.current.completionRate).toBeCloseTo(3.5 / 13);
  });

  it("compares only against the same user's previous week", () => {
    expect(review.previousWeekStart).toBe("2026-02-23");
    expect(review.previousWeekEnd).toBe("2026-03-01");
    expect(review.previous.scheduled).toBe(7);
    expect(review.previous.completed).toBe(5);
    expect(review.delta).toBeCloseTo((3.5 / 13 - 5 / 7) * 100);

    const first = review.habits[0]!;
    const second = review.habits[1]!;
    expect(first.name).toBe("Morning walk");
    expect(first.delta).toBeCloseTo((2.5 / 6 - 5 / 7) * 100);
    expect(second.name).toBe("Evening reading");
    expect(second.previous.scheduled).toBe(0);
    expect(second.delta).toBeNull();
  });

  it("surfaces check-in context and the private reflection without exposing other users", () => {
    expect(review.contextNotes).toEqual([
      {
        habitId: habitB.id,
        habitName: habitB.name,
        date: "2026-03-06",
        note: "Finished a chapter",
      },
      {
        habitId: habitA.id,
        habitName: habitA.name,
        date: "2026-03-03",
        note: "Low energy — kept it short",
      },
    ]);
    expect(review.note).toBe("Keep the week small.");
    expect(JSON.stringify(review)).not.toContain("partner");
  });
});
