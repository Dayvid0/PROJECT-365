import { describe, expect, it } from "vitest";
import {
  buildWorkspaceBackup,
  validateBackupIntegrity,
  workspaceBackupSchema,
  type WorkspaceBackupInput,
} from "../backup";
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
  quietHoursStart: "21:30",
  quietHoursEnd: "06:30",
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

function backupFixture(overrides: Partial<Parameters<typeof buildWorkspaceBackup>[0]> = {}) {
  return buildWorkspaceBackup({
    profile,
    habits: [habit],
    schedules: [schedule],
    exceptions: [exception],
    logs: [log],
    reminders: [reminder],
    weeklyNotes: [{ weekStart: "2025-12-29", note: "A quiet week", updatedAt: createdAt }],
    ...overrides,
  });
}

function parse(input: unknown): WorkspaceBackupInput {
  return workspaceBackupSchema.parse(input);
}

describe("workspace backup", () => {
  it("round-trips a complete workspace through the restore schema", () => {
    const backup = backupFixture();
    expect(parse(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
  });

  it("preserves reminder settings and private weekly notes", () => {
    const backup = backupFixture();
    expect(backup.profile.remindersEnabled).toBe(true);
    expect(backup.profile.quietHoursStart).toBe("21:30");
    expect(backup.profile.quietHoursEnd).toBe("06:30");
    expect(backup.weeklyNotes).toEqual([
      { weekStart: "2025-12-29", note: "A quiet week", updatedAt: createdAt },
    ]);
  });

  it("restores backups exported before the newer fields existed", () => {
    const backup = backupFixture();
    const legacy = {
      ...backup,
      weeklyNotes: undefined,
      profile: {
        timezone: backup.profile.timezone,
        streakPolicy: backup.profile.streakPolicy,
        notificationTime: backup.profile.notificationTime,
      },
    };
    const parsed = parse(legacy);
    expect(parsed.profile.remindersEnabled).toBe(false);
    expect(parsed.profile.quietHoursStart).toBe("22:00");
    expect(parsed.profile.quietHoursEnd).toBe("07:00");
    expect(parsed.weeklyNotes).toEqual([]);
  });

  it("rejects files from other formats", () => {
    expect(() => parse({ ...backupFixture(), format: "other" })).toThrow();
  });

  it("rejects malformed private notes and profile settings", () => {
    const backup = backupFixture();
    expect(() =>
      parse({ ...backup, weeklyNotes: [{ weekStart: "not-a-date", note: null, updatedAt: createdAt }] })
    ).toThrow();
    expect(() =>
      parse({ ...backup, profile: { ...backup.profile, quietHoursStart: "25:00" } })
    ).toThrow();
  });
});

describe("validateBackupIntegrity", () => {
  it("accepts a coherent backup", () => {
    expect(validateBackupIntegrity(parse(backupFixture()))).toEqual([]);
  });

  it("catches duplicate ids and records pointing at unknown habits", () => {
    const base = parse(backupFixture());
    expect(
      validateBackupIntegrity({ ...base, habits: [habit, habit] })
    ).toContain("Backup contains duplicate habit ids.");
    expect(
      validateBackupIntegrity({ ...base, logs: [{ ...base.logs[0]!, habitId: "missing" }] })
    ).toContain("Backup contains a logs record for an unknown habit.");
  });

  it("catches duplicate check-ins, schedule versions, reminders, and reflections", () => {
    const base = parse(backupFixture());
    expect(validateBackupIntegrity({ ...base, logs: [base.logs[0]!, base.logs[0]!] })).toContain(
      "Backup contains duplicate check-ins for a habit and date."
    );
    expect(validateBackupIntegrity({ ...base, schedules: [schedule, schedule] })).toContain(
      "Backup contains duplicate schedule versions for a habit."
    );
    expect(validateBackupIntegrity({ ...base, reminders: [reminder, reminder] })).toContain(
      "Backup contains more than one reminder for a habit."
    );
    const note = base.weeklyNotes[0]!;
    expect(validateBackupIntegrity({ ...base, weeklyNotes: [note, note] })).toContain(
      "Backup contains duplicate weekly reflections."
    );
  });
});
