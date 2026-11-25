import { describe, expect, it } from "vitest";
import {
  localDateForInstant,
  scheduledDatesForRange,
  scheduledOpportunitiesForRange,
  scheduleVersionForDate,
  summarizeOpportunities,
} from "../schedule";
import type { HabitLog, HabitSchedule, ScheduleException } from "../types";

function schedule(overrides: Partial<HabitSchedule> = {}): HabitSchedule {
  return {
    id: "schedule-1",
    habitId: "a",
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

function exception(overrides: Partial<ScheduleException> = {}): ScheduleException {
  return {
    id: "exception-1",
    habitId: "a",
    startDate: "2026-01-05",
    endDate: "2026-01-05",
    kind: "skip",
    reason: "Rest day",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("day boundaries", () => {
  it("uses the habit day-start minute and IANA timezone", () => {
    expect(localDateForInstant("2026-01-01T02:30:00.000Z", "UTC", 0)).toBe("2026-01-01");
    expect(localDateForInstant("2026-01-01T02:30:00.000Z", "UTC", 240)).toBe("2025-12-31");
    expect(localDateForInstant("2026-01-01T23:30:00.000Z", "America/New_York", 0)).toBe(
      "2026-01-01"
    );
  });
});

describe("schedule versions", () => {
  it("resolves the version effective on a given date", () => {
    const versions = [
      schedule({ id: "v1", version: 1, effectiveFrom: "2026-01-01", effectiveTo: "2026-01-09" }),
      schedule({ id: "v2", version: 2, effectiveFrom: "2026-01-10", effectiveTo: null }),
    ];
    expect(scheduleVersionForDate(versions, "2026-01-09")?.id).toBe("v1");
    expect(scheduleVersionForDate(versions, "2026-01-10")?.id).toBe("v2");
    expect(scheduleVersionForDate(versions, "2025-12-31")).toBeUndefined();
  });

  it("respects weekdays, intervals and monthly dates", () => {
    const weekdays = scheduledDatesForRange(
      [schedule({ cadence: "weekly", weekdays: [1, 3, 5] })],
      [],
      "2026-01-01",
      "2026-01-10",
      "a"
    );
    expect(weekdays).toEqual(["2026-01-02", "2026-01-05", "2026-01-07", "2026-01-09"]);

    const everyThirdDay = scheduledDatesForRange(
      [schedule({ cadence: "interval", intervalDays: 3 })],
      [],
      "2026-01-01",
      "2026-01-10",
      "a"
    );
    expect(everyThirdDay).toEqual(["2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10"]);

    const monthly = scheduledDatesForRange(
      [schedule({ cadence: "monthly", monthDay: 31 })],
      [],
      "2026-01-01",
      "2026-03-01",
      "a"
    );
    expect(monthly).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("expands multiple daily opportunities and excludes skips", () => {
    const opportunities = scheduledOpportunitiesForRange(
      [schedule({ timesPerDay: 2 })],
      [exception()],
      "2026-01-04",
      "2026-01-06",
      "a"
    );
    expect(opportunities.map((item) => `${item.date}#${item.occurrence}`)).toEqual([
      "2026-01-04#1",
      "2026-01-04#2",
      "2026-01-06#1",
      "2026-01-06#2",
    ]);
  });
});

describe("opportunity scoring", () => {
  it("scores missing check-ins as missed against the full schedule", () => {
    const logs: HabitLog[] = [
      { habitId: "a", date: "2026-01-01", status: 1, updatedAt: "2026-01-01T12:00:00Z", occurrence: 1 },
      { habitId: "a", date: "2026-01-02", status: 0.5, updatedAt: "2026-01-02T12:00:00Z", occurrence: 1 },
    ];
    const opportunities = scheduledOpportunitiesForRange(
      [schedule()],
      [],
      "2026-01-01",
      "2026-01-04",
      "a"
    );
    expect(summarizeOpportunities(logs, opportunities)).toEqual({
      scheduled: 4,
      completed: 1,
      partial: 1,
      missed: 2,
      completionRate: 0.375,
    });
  });
});
