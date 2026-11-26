import { z } from "zod";
import {
  CADENCE_KINDS,
  CHECKIN_SOURCES,
  HABIT_CATEGORIES,
  HABIT_KINDS,
  SCHEDULE_EXCEPTION_KINDS,
  STREAK_POLICIES,
} from "@/lib/constants";
import type {
  Habit,
  HabitLog,
  HabitReminder,
  HabitSchedule,
  ScheduleException,
  UserProfile,
} from "./types";

export const WORKSPACE_BACKUP_FORMAT = "project365-workspace";
export const WORKSPACE_BACKUP_VERSION = 1;

export interface WorkspaceBackup {
  format: typeof WORKSPACE_BACKUP_FORMAT;
  version: typeof WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  profile: Pick<
    UserProfile,
    | "timezone"
    | "streakPolicy"
    | "notificationTime"
    | "remindersEnabled"
    | "quietHoursStart"
    | "quietHoursEnd"
  >;
  habits: Habit[];
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  logs: HabitLog[];
  reminders: HabitReminder[];
  /** Private reflections only; never part of a share grant. */
  weeklyNotes: WorkspaceWeeklyNote[];
}

export interface WorkspaceWeeklyNote {
  weekStart: string;
  note: string | null;
  updatedAt: string;
}

export function buildWorkspaceBackup(input: {
  profile: UserProfile;
  habits: Habit[];
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  logs: HabitLog[];
  reminders: HabitReminder[];
  weeklyNotes: WorkspaceWeeklyNote[];
}): WorkspaceBackup {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      timezone: input.profile.timezone,
      streakPolicy: input.profile.streakPolicy,
      notificationTime: input.profile.notificationTime,
      remindersEnabled: input.profile.remindersEnabled,
      quietHoursStart: input.profile.quietHoursStart,
      quietHoursEnd: input.profile.quietHoursEnd,
    },
    habits: input.habits,
    schedules: input.schedules,
    exceptions: input.exceptions,
    logs: input.logs,
    reminders: input.reminders,
    weeklyNotes: input.weeklyNotes,
  };
}

const isoSchema = z.string().datetime({ offset: true });
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekdaysSchema = z.array(z.number().int().min(0).max(6)).max(7).default([]);

export const workspaceBackupSchema = z.object({
  format: z.literal(WORKSPACE_BACKUP_FORMAT),
  version: z.literal(WORKSPACE_BACKUP_VERSION),
  exportedAt: isoSchema,
  profile: z.object({
    timezone: z.string().min(1).max(120),
    streakPolicy: z.enum(STREAK_POLICIES),
    notificationTime: timeSchema,
    // Defaults keep backups exported before these fields existed restorable.
    remindersEnabled: z.boolean().default(false),
    quietHoursStart: timeSchema.default("22:00"),
    quietHoursEnd: timeSchema.default("07:00"),
  }),
  habits: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    description: z.string().nullable().default(null),
    category: z.enum(HABIT_CATEGORIES),
    order: z.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    createdAt: isoSchema,
    color: z.string().min(1),
    kind: z.enum(HABIT_KINDS),
    targetValue: z.number().positive().nullable().default(null),
    unit: z.string().nullable().default(null),
    targetDurationSeconds: z.number().int().positive().nullable().default(null),
  })),
  schedules: z.array(z.object({
    id: z.string().min(1),
    habitId: z.string().min(1),
    version: z.number().int().min(1),
    effectiveFrom: dateSchema,
    effectiveTo: dateSchema.nullable().default(null),
    cadence: z.enum(CADENCE_KINDS),
    weekdays: weekdaysSchema,
    timesPerWeek: z.number().int().min(1).max(7).nullable().default(null),
    intervalDays: z.number().int().min(1).nullable().default(null),
    monthDay: z.number().int().min(1).max(31).nullable().default(null),
    timesPerDay: z.number().int().min(1).max(12).default(1),
    targetValue: z.number().nullable().default(null),
    unit: z.string().nullable().default(null),
    targetDurationSeconds: z.number().int().nullable().default(null),
    dayStartMinute: z.number().int().min(0).max(1439).default(0),
    timezone: z.string().min(1),
    anchorDate: dateSchema,
    createdAt: isoSchema,
  })),
  exceptions: z.array(z.object({
    id: z.string().min(1),
    habitId: z.string().min(1),
    startDate: dateSchema,
    endDate: dateSchema,
    kind: z.enum(SCHEDULE_EXCEPTION_KINDS),
    reason: z.string().nullable().default(null),
    createdAt: isoSchema,
  })),
  logs: z.array(z.object({
    habitId: z.string().min(1),
    date: dateSchema,
    status: z.union([z.literal(0), z.literal(0.5), z.literal(1)]),
    updatedAt: isoSchema,
    occurrence: z.number().int().min(1).max(100).default(1),
    value: z.number().min(0).nullable().default(null),
    unit: z.string().nullable().default(null),
    note: z.string().nullable().default(null),
    source: z.enum(CHECKIN_SOURCES).default("manual"),
    startedAt: isoSchema.nullable().default(null),
    endedAt: isoSchema.nullable().default(null),
    createdAt: isoSchema.optional(),
    editedAt: isoSchema.nullable().default(null),
  })),
  reminders: z.array(z.object({
    id: z.string().min(1),
    habitId: z.string().min(1),
    enabled: z.boolean(),
    time: timeSchema,
    weekdays: weekdaysSchema,
    snoozeMinutes: z.number().int().min(0).max(240).default(10),
    stopAfterCompletion: z.boolean().default(true),
    createdAt: isoSchema,
  })),
  weeklyNotes: z.array(z.object({
    weekStart: dateSchema,
    note: z.string().nullable().default(null),
    updatedAt: isoSchema,
  })).default([]),
});

export type WorkspaceBackupInput = z.infer<typeof workspaceBackupSchema>;

/**
 * Referential checks that a transaction cannot describe in a user-facing way.
 * Returned messages are safe to show directly in the restore dialog.
 */
export function validateBackupIntegrity(backup: WorkspaceBackupInput): string[] {
  const issues: string[] = [];
  const habitIds = new Set<string>();
  for (const habit of backup.habits) {
    if (habitIds.has(habit.id)) {
      issues.push("Backup contains duplicate habit ids.");
      break;
    }
    habitIds.add(habit.id);
  }

  const collections: Array<[string, Array<{ habitId: string }>]> = [
    ["schedules", backup.schedules],
    ["exceptions", backup.exceptions],
    ["logs", backup.logs],
    ["reminders", backup.reminders],
  ];
  for (const [label, items] of collections) {
    if (items.some((item) => !habitIds.has(item.habitId))) {
      issues.push(`Backup contains a ${label} record for an unknown habit.`);
    }
  }

  const scheduleKeys = new Set<string>();
  for (const item of backup.schedules) {
    const key = `${item.habitId}:${item.version}`;
    if (scheduleKeys.has(key)) {
      issues.push("Backup contains duplicate schedule versions for a habit.");
      break;
    }
    scheduleKeys.add(key);
  }

  const reminderHabits = new Set<string>();
  for (const item of backup.reminders) {
    if (reminderHabits.has(item.habitId)) {
      issues.push("Backup contains more than one reminder for a habit.");
      break;
    }
    reminderHabits.add(item.habitId);
  }

  const logKeys = new Set<string>();
  for (const item of backup.logs) {
    const key = `${item.habitId}:${item.date}:${item.occurrence ?? 1}`;
    if (logKeys.has(key)) {
      issues.push("Backup contains duplicate check-ins for a habit and date.");
      break;
    }
    logKeys.add(key);
  }

  const weeks = new Set<string>();
  for (const item of backup.weeklyNotes) {
    if (weeks.has(item.weekStart)) {
      issues.push("Backup contains duplicate weekly reflections.");
      break;
    }
    weeks.add(item.weekStart);
  }
  return issues;
}
