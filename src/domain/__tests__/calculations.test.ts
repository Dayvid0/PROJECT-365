import { describe, expect, it } from "vitest";
import {
  buildMonthlySnapshot,
  currentStreak,
  cycleStatus,
  dedupeLogs,
  formatPercent,
  getMonthDayGrid,
  habitCompletionRate,
  resolveStatus,
  shiftMonth,
  streakSummary,
  weeklyAverage,
} from "../calculations";
import type { Habit, HabitLog, HabitSchedule } from "../types";

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    description: null,
    category: "health",
    order: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    color: "#22C55E",
    kind: "check_in",
    targetValue: null,
    unit: null,
    targetDurationSeconds: null,
    ...overrides,
  };
}

function log(date: string, habitId = "a", status: 0 | 0.5 | 1 = 1): HabitLog {
  return { habitId, date, status, updatedAt: `${date}T12:00:00.000Z`, occurrence: 1 };
}

function schedule(
  habitId: string,
  overrides: Partial<HabitSchedule> = {}
): HabitSchedule {
  return {
    id: `schedule-${habitId}`,
    habitId,
    version: 1,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
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
    anchorDate: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("status cycling", () => {
  it("cycles no-log → complete → partial → missed → complete", () => {
    expect(cycleStatus(undefined)).toBe(1);
    expect(cycleStatus(1)).toBe(0.5);
    expect(cycleStatus(0.5)).toBe(0);
    expect(cycleStatus(0)).toBe(1);
  });
});

describe("rates and streaks", () => {
  it("counts only logged days when no schedule is supplied", () => {
    expect(habitCompletionRate([log("2026-01-01"), log("2026-01-02", "a", 0.5)])).toBe(0.75);
    expect(habitCompletionRate([])).toBe(0);
  });

  it("uses scheduled opportunities as the denominator", () => {
    const logs = [log("2026-01-01", "a", 1)];
    const scheduledDates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
    expect(habitCompletionRate(logs, scheduledDates)).toBe(0.25);
  });

  it("derives count and timer statuses from values", () => {
    const count = habit("count", { kind: "count", targetValue: 20 });
    const timer = habit("timer", { kind: "timer", targetDurationSeconds: 1800 });
    expect(resolveStatus(count, undefined, 20)).toBe(1);
    expect(resolveStatus(count, undefined, 10)).toBe(0.5);
    expect(resolveStatus(timer, undefined, 900)).toBe(0.5);
    expect(resolveStatus(timer, undefined, 1800)).toBe(1);
  });

  it("returns zero for empty weekly averages", () => {
    expect(weeklyAverage([])).toBe(0);
  });

  it("counts consecutive eligible days ending today", () => {
    const today = new Date("2026-03-03T12:00:00.000Z");
    const logs = [
      log("2026-03-01"),
      log("2026-03-02"),
      log("2026-03-03"),
      log("2026-02-28", "a", 0),
    ];
    expect(currentStreak(logs, today)).toBe(3);
    expect(
      currentStreak(logs, today, ["2026-03-01", "2026-03-02", "2026-03-03"])
    ).toBe(3);
  });

  it("formats ratios with one decimal", () => {
    expect(formatPercent(0.727)).toBe("72.7%");
  });

  it("hides streaks entirely when the policy is off", () => {
    const today = new Date("2026-03-03T12:00:00.000Z");
    expect(streakSummary([log("2026-03-03")], ["2026-03-03"], "off", today)).toEqual({
      current: 0,
      best: 0,
      visible: false,
      label: "Streaks hidden",
    });
  });

  it("counts recent scheduled opportunities under the gentle policy", () => {
    const today = new Date("2026-03-03T12:00:00.000Z");
    const dates = ["2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03"];
    const logs = [
      log("2026-02-26", "a", 0),
      log("2026-02-27"),
      log("2026-03-01"),
      log("2026-03-02"),
    ];
    expect(streakSummary(logs, dates, "target", today)).toMatchObject({
      current: 3,
      best: 3,
      visible: true,
    });
  });

  it("keeps strict streaks based on consecutive scheduled days", () => {
    const today = new Date("2026-03-03T12:00:00.000Z");
    const dates = ["2026-03-01", "2026-03-02", "2026-03-03"];
    expect(streakSummary([log("2026-03-02"), log("2026-03-03")], dates, "strict", today)).toMatchObject({
      current: 2,
      best: 2,
      visible: true,
    });
  });
});

describe("monthly snapshot", () => {
  it("scores against scheduled opportunities, not logged days", () => {
    const habits = [habit("a", { name: "Run" }), habit("b", { name: "Read" })];
    const logs = [
      log("2026-01-01", "a", 1),
      log("2026-01-01", "b", 0),
      log("2026-01-08", "a", 0.5),
      log("2026-01-08", "b", 1),
    ];
    const snapshot = buildMonthlySnapshot(
      "2026-01",
      habits,
      logs,
      new Date("2026-01-31T00:00:00.000Z"),
      { schedules: [schedule("a"), schedule("b")] }
    );

    expect(snapshot.habitScores.a).toBeCloseTo(1.5 / 31, 6);
    expect(snapshot.habitScores.b).toBeCloseTo(1 / 31, 6);
    expect(snapshot.scheduledOpportunities).toEqual({ a: 31, b: 31 });
    expect(snapshot.dailyScores["2026-01-01"]).toBe(0.5);
    expect(snapshot.dailyScores["2026-01-08"]).toBe(0.75);
    expect(snapshot.weeklyAverages.week1).toBeCloseTo(0.5 / 7, 6);
    expect(snapshot.weeklyAverages.week2).toBeCloseTo(0.75 / 7, 6);
    expect(snapshot.bestHabit?.name).toBe("Run");
    expect(snapshot.worstHabit?.name).toBe("Read");
    expect(snapshot.completionRate).toBeCloseTo(1.25 / 31, 6);
    expect(snapshot.failureRate).toBeCloseTo(1 - 1.25 / 31, 6);
    expect(snapshot.calculationVersion).toBe(2);
    expect(snapshot.generatedAt).toBe("2026-01-31T00:00:00.000Z");
  });

  it("does not count skipped days as missed opportunities", () => {
    const logs = [log("2026-01-01", "a", 1)];
    const snapshot = buildMonthlySnapshot("2026-01", [habit("a")], logs, new Date(), {
      schedules: [schedule("a")],
      exceptions: [
        {
          id: "break-1",
          habitId: "a",
          startDate: "2026-01-02",
          endDate: "2026-01-31",
          kind: "planned_break",
          reason: "Travel",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(snapshot.scheduledOpportunities?.a).toBe(1);
    expect(snapshot.habitScores.a).toBe(1);
  });

  it("excludes habits with no schedule this month from the overall rate", () => {
    const snapshot = buildMonthlySnapshot(
      "2026-01",
      [habit("a", { name: "Tracked" }), habit("b", { name: "Not yet tracked" })],
      [log("2026-01-01", "a", 1)],
      new Date(),
      { schedules: [schedule("a", { effectiveTo: "2026-01-01" })] }
    );

    expect(snapshot.scheduledOpportunities).toEqual({ a: 1, b: 0 });
    expect(snapshot.completionRate).toBe(1);
    expect(snapshot.bestHabit?.name).toBe("Tracked");
    expect(snapshot.worstHabit?.name).toBe("Tracked");
  });

  it("ignores archived habits", () => {
    const snapshot = buildMonthlySnapshot(
      "2026-01",
      [habit("a"), habit("archived", { isActive: false })],
      [log("2026-01-01", "archived")]
    );
    expect(snapshot.habitScores).toEqual({ a: 0 });
  });
});

describe("calendar helpers", () => {
  it("splits a 31-day month into four weekly buckets", () => {
    const weeks = getMonthDayGrid("2026-01");
    expect(weeks.map((week) => week.length)).toEqual([7, 7, 7, 10]);
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("keeps the last write when de-duplicating logs", () => {
    expect(dedupeLogs([log("2026-01-01", "a", 1), log("2026-01-01", "a", 0)])).toEqual([
      log("2026-01-01", "a", 0),
    ]);
  });

  it("keeps separate occurrences of the same day", () => {
    const first = { ...log("2026-01-01", "a", 1), occurrence: 1 };
    const second = { ...log("2026-01-01", "a", 0.5), occurrence: 2 };
    expect(dedupeLogs([first, second])).toEqual([first, second]);
  });
});
