import { describe, expect, it } from "vitest";
import {
  circleCreateSchema,
  circleInviteSchema,
  circlePatchSchema,
  circleRoleSchema,
  createHabitSchema,
  createScheduleVersionSchema,
  dateSchema,
  deleteAccountSchema,
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

  it("requires an explicit account deletion confirmation", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "  " }).success).toBe(false);
    const parsed = deleteAccountSchema.safeParse({ confirmation: "  me@example.com " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.confirmation).toBe("me@example.com");
  });

  it("validates circle creation and patch input", () => {
    expect(circleCreateSchema.safeParse({ name: "Walk crew" }).success).toBe(true);
    expect(circleCreateSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(circlePatchSchema.safeParse({}).success).toBe(false);
    expect(circlePatchSchema.safeParse({ description: "Kind check-ins" }).success).toBe(true);
  });

  it("requires an exact email and prevents assigning the owner role", () => {
    expect(circleInviteSchema.safeParse({ email: "friend@example.com" }).success).toBe(true);
    expect(circleInviteSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(circleRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(circleRoleSchema.safeParse({ role: "owner" }).success).toBe(false);
  });
});
