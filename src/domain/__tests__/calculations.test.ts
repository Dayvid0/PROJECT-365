import { describe, expect, it } from "vitest";
import {
  buildMonthlySnapshot,
  currentStreak,
  cycleStatus,
  dedupeLogs,
  formatPercent,
  getMonthDayGrid,
  habitCompletionRate,
  shiftMonth,
  weeklyAverage,
} from "../calculations";
import type { Habit, HabitLog } from "../types";

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    category: "health",
    order: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    color: "#22C55E",
    ...overrides,
  };
}

function log(date: string, habitId = "a", status: 0 | 0.5 | 1 = 1): HabitLog {
  return { habitId, date, status, updatedAt: `${date}T12:00:00.000Z` };
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
  it("counts only logged days for habit completion", () => {
    expect(habitCompletionRate([log("2026-01-01"), log("2026-01-02", "a", 0.5)])).toBe(0.75);
    expect(habitCompletionRate([])).toBe(0);
  });

  it("returns zero for empty weekly averages", () => {
    expect(weeklyAverage([])).toBe(0);
  });

  it("counts consecutive complete days ending today", () => {
    const today = new Date("2026-03-03T12:00:00.000Z");
    const logs = [
      log("2026-03-01"),
      log("2026-03-02"),
      log("2026-03-03"),
      log("2026-02-28", "a", 0),
    ];
    expect(currentStreak(logs, today)).toBe(3);
  });

  it("formats ratios with one decimal", () => {
    expect(formatPercent(0.727)).toBe("72.7%");
  });
});

describe("monthly snapshot", () => {
  it("builds habit, daily, weekly, and best/worst scores", () => {
    const habits = [habit("a", { name: "Run" }), habit("b", { name: "Read" })];
    const logs = [
      log("2026-01-01", "a", 1),
      log("2026-01-01", "b", 0),
      log("2026-01-08", "a", 0.5),
      log("2026-01-08", "b", 1),
    ];
    const snapshot = buildMonthlySnapshot("2026-01", habits, logs, new Date("2026-01-31T00:00:00.000Z"));

    expect(snapshot.habitScores).toEqual({ a: 0.75, b: 0.5 });
    expect(snapshot.dailyScores["2026-01-01"]).toBe(0.5);
    expect(snapshot.weeklyAverages.week1).toBe(0.5);
    expect(snapshot.weeklyAverages.week2).toBe(0.75);
    expect(snapshot.bestHabit?.name).toBe("Run");
    expect(snapshot.worstHabit?.name).toBe("Read");
    expect(snapshot.completionRate).toBe(0.625);
    expect(snapshot.failureRate).toBe(0.375);
    expect(snapshot.generatedAt).toBe("2026-01-31T00:00:00.000Z");
  });

  it("ignores archived habits", () => {
    const habits = [habit("a"), habit("archived", { isActive: false })];
    const snapshot = buildMonthlySnapshot("2026-01", habits, [log("2026-01-01", "archived")]);
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
});
