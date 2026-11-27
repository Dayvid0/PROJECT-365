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
  CIRCLE_INVITE_STATUSES,
  CIRCLE_REACTION_KINDS,
  CIRCLE_ROLES,
  HABIT_CATEGORIES,
  HABIT_KINDS,
  PARTNER_INVITE_STATUSES,
  PUBLIC_CHALLENGE_STATUSES,
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

/** Private, invite-only groups. A circle never exposes member habits on its own. */
export const circles = sqliteTable(
  "circles",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("circles_owner_idx").on(table.ownerUserId)]
);

export const circleMemberships = sqliteTable(
  "circle_memberships",
  {
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: CIRCLE_ROLES }).notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.circleId, table.userId] }),
    index("circle_memberships_user_idx").on(table.userId),
  ]
);

/** Exact-email invitations with a secret token shared out of band. No user search. */
export const circleInvites = sqliteTable(
  "circle_invites",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviteeEmail: text("invitee_email").notNull(),
    inviteeUserId: text("invitee_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    token: text("token").notNull(),
    status: text("status", { enum: CIRCLE_INVITE_STATUSES }).notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("circle_invites_token_uidx").on(table.token),
    index("circle_invites_circle_idx").on(table.circleId),
    index("circle_invites_invitee_email_idx").on(table.inviteeEmail),
    check(
      "circle_invites_status_target_check",
      sql`(${table.status} <> 'accepted' OR ${table.inviteeUserId} IS NOT NULL)`
    ),
  ]
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
    circleId: text("circle_id").references(() => circles.id, { onDelete: "cascade" }),
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

/**
 * Supportive interactions attach only to a still-active, circle-scoped grant.
 * Reactions are anonymous counts; comments are authored support, not habit data.
 */
export const circleReactions = sqliteTable(
  "circle_reactions",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    grantId: text("grant_id")
      .notNull()
      .references(() => shareGrants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: CIRCLE_REACTION_KINDS }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("circle_reactions_circle_grant_user_uidx").on(
      table.circleId,
      table.grantId,
      table.userId
    ),
    index("circle_reactions_grant_idx").on(table.grantId),
  ]
);

export const circleComments = sqliteTable(
  "circle_comments",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    grantId: text("grant_id")
      .notNull()
      .references(() => shareGrants.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("circle_comments_circle_grant_idx").on(table.circleId, table.grantId),
    index("circle_comments_author_idx").on(table.authorUserId),
    check("circle_comments_body_check", sql`length(${table.body}) between 1 and 1000`),
  ]
);

/**
 * Challenges here are circle-local intentions with opt-in participation. They
 * never become public; a separate, moderation-gated table handles discovery.
 */
export const circleChallenges = sqliteTable(
  "circle_challenges",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    circleId: text("circle_id")
      .notNull()
      .references(() => circles.id, { onDelete: "cascade" }),
    creatorUserId: text("creator_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("circle_challenges_circle_idx").on(table.circleId),
    check("circle_challenges_title_check", sql`length(${table.title}) between 1 and 80`),
    check("circle_challenges_window_check", sql`${table.endsAt} > ${table.startsAt}`),
  ]
);

export const circleChallengeParticipants = sqliteTable(
  "circle_challenge_participants",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => circleChallenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.challengeId, table.userId] }),
    index("circle_challenge_participants_user_idx").on(table.userId),
  ]
);

/**
 * Public challenges are standalone intentions, never linked to a habit, grant,
 * or progress record. They stay hidden until an allowlisted moderator approves.
 */
export const publicChallenges = sqliteTable(
  "public_challenges",
  {
    id: text("id").primaryKey().$defaultFn(() => ulid()),
    proposerUserId: text("proposer_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    category: text("category", { enum: HABIT_CATEGORIES }).notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: PUBLIC_CHALLENGE_STATUSES }).notNull().default("proposed"),
    policyVersion: text("policy_version").notNull(),
    reviewNote: text("review_note"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index("public_challenges_status_idx").on(table.status),
    index("public_challenges_proposer_idx").on(table.proposerUserId),
    check("public_challenges_title_check", sql`length(${table.title}) between 1 and 80`),
    check("public_challenges_summary_check", sql`length(${table.summary}) between 1 and 500`),
    check("public_challenges_window_check", sql`${table.endsAt} > ${table.startsAt}`),
  ]
);

export const publicChallengeParticipants = sqliteTable(
  "public_challenge_participants",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => publicChallenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.challengeId, table.userId] }),
    index("public_challenge_participants_user_idx").on(table.userId),
  ]
);

/** A personal filter: hiding removes a challenge from one viewer's list only. */
export const publicChallengeHides = sqliteTable(
  "public_challenge_hides",
  {
    challengeId: text("challenge_id")
      .notNull()
      .references(() => publicChallenges.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.challengeId, table.userId] }),
    index("public_challenge_hides_user_idx").on(table.userId),
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
    circleId: text("circle_id").references(() => circles.id, { onDelete: "cascade" }),
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

/** Reporter-owned on the client; allowlisted moderators own the review queue. */
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
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
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
