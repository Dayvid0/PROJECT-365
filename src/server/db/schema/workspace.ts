import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { ulid } from "ulidx";
import {
  CADENCE_KINDS,
  CHECKIN_SOURCES,
  HABIT_CATEGORIES,
  HABIT_KINDS,
  PARTNER_INVITE_STATUSES,
  REPORT_CATEGORIES,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  SAFETY_CONTROL_KINDS,
  SCHEDULE_EXCEPTION_KINDS,
  SHARE_AUDIENCES,
  SHARE_FREQUENCIES,
  STREAK_POLICIES,
} from "@/lib/constants";
import type { ShareField } from "@/domain/types";
import { users } from "./auth";

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme", { enum: ["light", "dark"] }).notNull().default("dark"),
  notificationTime: text("notification_time").notNull().default("08:00"),
  onboardingCompleted: integer("onboarding_completed", { mode: "boolean" }).notNull().default(false),
  streakPolicy: text("streak_policy", { enum: STREAK_POLICIES }).notNull().default("strict"),
  remindersEnabled: integer("reminders_enabled", { mode: "boolean" }).notNull().default(false),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("07:00"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** One private reflection per calendar week. Never part of any shared projection. */
export const weeklyReviews = sqliteTable(
  "weekly_reviews",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    weekStart: text("week_start").notNull(),
    note: text("note"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.weekStart] })]
);

export const habits = sqliteTable(
  "habits",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category", { enum: HABIT_CATEGORIES }).notNull(),
    position: integer("position").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    color: text("color").notNull(),
    kind: text("kind", { enum: HABIT_KINDS }).notNull().default("check_in"),
    targetValue: real("target_value"),
    unit: text("unit"),
    targetDurationSeconds: integer("target_duration_seconds"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("habits_user_position_idx").on(table.userId, table.position),
    index("habits_user_active_idx").on(table.userId, table.isActive),
  ]
);

/** Immutable cadence versions; historical dates keep the version that governed them. */
export const habitScheduleVersions = sqliteTable(
  "habit_schedule_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    cadence: text("cadence", { enum: CADENCE_KINDS }).notNull(),
    weekdays: text("weekdays", { mode: "json" }).$type<number[]>().notNull().default([]),
    timesPerWeek: integer("times_per_week"),
    intervalDays: integer("interval_days"),
    monthDay: integer("month_day"),
    timesPerDay: integer("times_per_day").notNull().default(1),
    targetValue: real("target_value"),
    unit: text("unit"),
    targetDurationSeconds: integer("target_duration_seconds"),
    dayStartMinute: integer("day_start_minute").notNull().default(0),
    timezone: text("timezone").notNull().default("UTC"),
    anchorDate: text("anchor_date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("habit_schedule_versions_user_habit_version_uidx").on(
      table.userId,
      table.habitId,
      table.version
    ),
    index("habit_schedule_versions_user_habit_effective_idx").on(
      table.userId,
      table.habitId,
      table.effectiveFrom
    ),
    index("habit_schedule_versions_user_effective_idx").on(table.userId, table.effectiveFrom),
  ]
);

export const habitScheduleExceptions = sqliteTable(
  "habit_schedule_exceptions",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    kind: text("kind", { enum: SCHEDULE_EXCEPTION_KINDS }).notNull(),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("habit_schedule_exceptions_user_habit_dates_idx").on(
      table.userId,
      table.habitId,
      table.startDate,
      table.endDate
    ),
    index("habit_schedule_exceptions_user_dates_idx").on(table.userId, table.startDate),
  ]
);

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    status: real("status").notNull(),
    occurrence: integer("occurrence").notNull().default(1),
    value: real("value"),
    unit: text("unit"),
    note: text("note"),
    source: text("source", { enum: CHECKIN_SOURCES }).notNull().default("manual"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    isSkip: integer("is_skip", { mode: "boolean" }).notNull().default(false),
    plannedBreak: integer("planned_break", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("habit_logs_user_habit_date_occurrence_uidx").on(
      table.userId,
      table.habitId,
      table.date,
      table.occurrence
    ),
    index("habit_logs_user_date_idx").on(table.userId, table.date),
    check("habit_logs_status_check", sql`${table.status} in (0, 0.5, 1)`),
  ]
);

export const habitReminders = sqliteTable(
  "habit_reminders",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    time: text("time").notNull().default("08:00"),
    weekdays: text("weekdays", { mode: "json" }).$type<number[]>().notNull().default([]),
    snoozeMinutes: integer("snooze_minutes").notNull().default(10),
    stopAfterCompletion: integer("stop_after_completion", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("habit_reminders_user_habit_uidx").on(table.userId, table.habitId),
    index("habit_reminders_user_enabled_idx").on(table.userId, table.enabled),
  ]
);

/**
 * Partner invites are explicit and email-bound. There is no user search or
 * public profile lookup: the invite link is shared out of band by its owner.
 */
export const partnerInvites = sqliteTable(
  "partner_invites",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeUserId: text("invitee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull(),
    status: text("status", { enum: PARTNER_INVITE_STATUSES }).notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("partner_invites_token_uidx").on(table.token),
    index("partner_invites_inviter_idx").on(table.inviterUserId),
    index("partner_invites_invitee_email_idx").on(table.inviteeEmail),
    check(
      "partner_invites_status_target_check",
      sql`(${table.status} <> 'accepted' OR ${table.inviteeUserId} IS NOT NULL)`
    ),
  ]
);

/**
 * Consent records. A grant is the only source of truth for shared projections;
 * revocation stops future access without pretending already-seen content vanished.
 */
export const shareGrants = sqliteTable(
  "share_grants",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    audience: text("audience", { enum: SHARE_AUDIENCES }).notNull(),
    habitId: text("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    recipientUserId: text("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
    circleId: text("circle_id"),
    alias: text("alias"),
    fields: text("fields", { mode: "json" }).$type<ShareField[]>().notNull(),
    frequency: text("frequency", { enum: SHARE_FREQUENCIES }).notNull(),
    consentVersion: integer("consent_version").notNull().default(1),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("share_grants_user_habit_idx").on(table.userId, table.habitId),
    index("share_grants_recipient_idx").on(table.recipientUserId),
    check(
      "share_grants_audience_target_check",
      sql`((${table.audience} = 'partner' AND ${table.recipientUserId} IS NOT NULL AND ${table.circleId} IS NULL) OR (${table.audience} = 'circle' AND ${table.circleId} IS NOT NULL AND ${table.recipientUserId} IS NULL))`
    ),
  ]
);

/** User-controlled boundaries: block, mute, or leave. No support-only path. */
export const safetyControls = sqliteTable(
  "safety_controls",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: SAFETY_CONTROL_KINDS }).notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    circleId: text("circle_id"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("safety_controls_user_target_uidx").on(
      table.userId,
      table.kind,
      table.targetUserId,
      table.circleId
    ),
    check(
      "safety_controls_target_check",
      sql`((${table.kind} = 'leave' AND ${table.circleId} IS NOT NULL AND ${table.targetUserId} IS NULL) OR (${table.kind} <> 'leave' AND ${table.targetUserId} IS NOT NULL AND ${table.circleId} IS NULL))`
    ),
  ]
);

/** Reports stay visible to the reporter; moderation workflow comes later. */
export const safetyReports = sqliteTable(
  "safety_reports",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    reporterUserId: text("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: REPORT_TARGET_TYPES }).notNull(),
    targetId: text("target_id").notNull(),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category", { enum: REPORT_CATEGORIES }).notNull(),
    detail: text("detail").notNull(),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("safety_reports_reporter_idx").on(table.reporterUserId),
    index("safety_reports_target_user_idx").on(table.targetUserId),
    index("safety_reports_status_idx").on(table.status),
  ]
);

/** Persisted monthly analytics cache; JSON payload keeps the snapshot shape portable. */
export const monthlySnapshots = sqliteTable(
  "monthly_snapshots",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    payload: text("payload").notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })]
);

export type HabitRow = typeof habits.$inferSelect;
export type HabitLogRow = typeof habitLogs.$inferSelect;
export type HabitScheduleVersionRow = typeof habitScheduleVersions.$inferSelect;
export type ScheduleExceptionRow = typeof habitScheduleExceptions.$inferSelect;
export type HabitReminderRow = typeof habitReminders.$inferSelect;
