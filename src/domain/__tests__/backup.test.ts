import { describe, expect, it } from "vitest";
import { buildWorkspaceBackup, workspaceBackupSchema } from "../backup";
import type {
  Habit,
  HabitLog,
  HabitReminder,
  HabitSchedule,
  ScheduleException,
  UserProfile,
} from "../types";

const createdAt = "2026-01-01T00:00:00.000Z";

const profile: UserProfile = {
  id: "user-1",
  name: "Test",
  email: "test@example.com",
  timezone: "UTC",
  theme: "dark",
  notificationTime: "08:00",
  onboardingCompleted: true,
  streakPolicy: "target",
  remindersEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  createdAt,
};

const habit: Habit = {
  id: "habit-1",
  name: "Read",
  description: null,
  category: "learning",
  order: 0,
  isActive: true,
  createdAt,
  color: "#22c55e",
  kind: "check_in",
  targetValue: null,
  unit: null,
  targetDurationSeconds: null,
};

const schedule: HabitSchedule = {
  id: "schedule-1",
  habitId: habit.id,
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
  createdAt,
};

const exception: ScheduleException = {
  id: "exception-1",
  habitId: habit.id,
  startDate: "2026-01-02",
  endDate: "2026-01-03",
  kind: "planned_break",
  reason: "Travel",
  createdAt,
};

const log: HabitLog = {
  habitId: habit.id,
  date: "2026-01-01",
  status: 1,
  updatedAt: createdAt,
  occurrence: 1,
  value: null,
  unit: null,
  note: "Good start",
  source: "manual",
  startedAt: null,
  endedAt: null,
  createdAt,
  editedAt: null,
};

const reminder: HabitReminder = {
  id: "reminder-1",
  habitId: habit.id,
  enabled: true,
  time: "08:00",
  weekdays: [1, 2, 3],
  snoozeMinutes: 10,
  stopAfterCompletion: true,
  createdAt,
};

describe("workspace backup", () => {
  it("round-trips a complete workspace through the restore schema", () => {
    const backup = buildWorkspaceBackup({
      profile,
      habits: [habit],
      schedules: [schedule],
      exceptions: [exception],
      logs: [log],
      reminders: [reminder],
    });

    expect(
      workspaceBackupSchema.parse(JSON.parse(JSON.stringify(backup)))
    ).toEqual(backup);
  });

  it("rejects files from other formats", () => {
    const backup = buildWorkspaceBackup({
      profile,
      habits: [],
      schedules: [],
      exceptions: [],
      logs: [],
      reminders: [],
    });
    expect(() => workspaceBackupSchema.parse({ ...backup, format: "other" })).toThrow();
  });
});
