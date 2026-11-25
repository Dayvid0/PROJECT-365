import { describe, expect, it } from "vitest";
import {
  createHabitSchema,
  createScheduleVersionSchema,
  dateSchema,
  monthSchema,
  preferencesPatchSchema,
  scheduleExceptionSchema,
  statusSchema,
  upsertLogsSchema,
} from "../validation";

describe("HTTP input validation", () => {
  it("accepts only YYYY-MM months", () => {
    expect(monthSchema.safeParse("2026-01").success).toBe(true);
    expect(monthSchema.safeParse("2026-13").success).toBe(false);
    expect(monthSchema.safeParse("Jan 2026").success).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(dateSchema.safeParse("2026-02-28").success).toBe(true);
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
  });

  it("accepts only the three habit statuses", () => {
    expect(statusSchema.safeParse(0.5).success).toBe(true);
    expect(statusSchema.safeParse(0.25).success).toBe(false);
  });

  it("validates habit creation", () => {
    expect(
      createHabitSchema.safeParse({
        name: "Read",
        category: "learning",
        color: "#3B82F6",
        order: 0,
      }).success
    ).toBe(true);
    expect(
      createHabitSchema.safeParse({
        name: "  ",
        category: "learning",
        color: "blue",
        order: -1,
      }).success
    ).toBe(false);
  });

  it("requires real timestamps in bulk log writes", () => {
    const base = {
      habitId: "habit-1",
      date: "2026-01-01",
      status: 1,
      updatedAt: "2026-01-01T12:00:00.000Z",
    };
    expect(upsertLogsSchema.safeParse([base]).success).toBe(true);
    expect(upsertLogsSchema.safeParse([{ ...base, updatedAt: "today" }]).success).toBe(false);
    expect(upsertLogsSchema.safeParse([]).success).toBe(false);
  });

  it("requires at least one preference change", () => {
    expect(preferencesPatchSchema.safeParse({}).success).toBe(false);
    expect(preferencesPatchSchema.safeParse({ theme: "dark" }).success).toBe(true);
  });

  it("validates schedule versions and timezones", () => {
    expect(
      createScheduleVersionSchema.safeParse({
        effectiveFrom: "2026-01-01",
        cadence: "weekly",
        weekdays: [1, 3, 5],
        timezone: "Africa/Kampala",
      }).success
    ).toBe(true);
    expect(
      createScheduleVersionSchema.safeParse({
        effectiveFrom: "2026-01-01",
        cadence: "weekly",
      }).success
    ).toBe(false);
    expect(
      createScheduleVersionSchema.safeParse({
        effectiveFrom: "2026-01-01",
        cadence: "interval",
        timezone: "Mars/Olympus",
      }).success
    ).toBe(false);
  });

  it("rejects inverted planned breaks", () => {
    expect(
      scheduleExceptionSchema.safeParse({
        startDate: "2026-01-10",
        endDate: "2026-01-01",
        kind: "planned_break",
      }).success
    ).toBe(false);
  });
});
