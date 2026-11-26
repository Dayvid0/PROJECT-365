import { and, eq, gte, inArray, isNull, lte, max, sql } from "drizzle-orm";
import { ulid } from "ulidx";
import { resolveStatus, buildMonthlySnapshot, toMonthString } from "@/domain/calculations";
import {
  addDays,
  localDateForInstant,
  scheduledOpportunitiesForRange,
} from "@/domain/schedule";
import { buildDefaultHabits } from "@/domain/defaults";
import { buildWorkspaceBackup, validateBackupIntegrity } from "@/domain/backup";
import type { WorkspaceBackupInput } from "@/domain/backup";
import type {
  AnalyticsRangeData,
  BootstrapData,
  Habit,
  HabitLog,
  HabitReminder,
  HabitSchedule,
  MonthlySnapshot,
  ScheduleException,
  ScheduledOpportunity,
  UserProfile,
} from "@/domain/types";
import type {
  CreateHabitInput,
  CreateScheduleVersionInput,
  DeleteLogInput,
  HabitReminderInput,
  PreferencesPatchSchemaType,
  ProfilePatchInput,
  ScheduleExceptionInput,
  UpdateHabitInput,
  UpsertLogsInput,
} from "@/domain/validation";
import { db, type DbExecutor } from "@/server/db";
import {
  habitLogs,
  habitReminders,
  habitScheduleExceptions,
  habitScheduleVersions,
  habits,
  monthlySnapshots,
  userPreferences,
  users,
  weeklyReviews,
  type HabitLogRow,
  type HabitReminderRow,
  type HabitRow,
  type HabitScheduleVersionRow,
  type ScheduleExceptionRow,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    order: row.position,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    color: row.color,
    kind: row.kind,
    targetValue: row.targetValue,
    unit: row.unit,
    targetDurationSeconds: row.targetDurationSeconds,
  };
}

function toLog(row: HabitLogRow): HabitLog {
  return {
    habitId: row.habitId,
    date: row.date,
    status: row.status as HabitLog["status"],
    updatedAt: row.updatedAt.toISOString(),
    occurrence: row.occurrence,
    value: row.value,
    unit: row.unit,
    note: row.note,
    source: row.source,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
  };
}

function toSchedule(row: HabitScheduleVersionRow): HabitSchedule {
  return {
    id: row.id,
    habitId: row.habitId,
    version: row.version,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    cadence: row.cadence,
    weekdays: row.weekdays ?? [],
    timesPerWeek: row.timesPerWeek,
    intervalDays: row.intervalDays,
    monthDay: row.monthDay,
    timesPerDay: row.timesPerDay,
    targetValue: row.targetValue,
    unit: row.unit,
    targetDurationSeconds: row.targetDurationSeconds,
    dayStartMinute: row.dayStartMinute,
    timezone: row.timezone,
    anchorDate: row.anchorDate,
    createdAt: row.createdAt.toISOString(),
  };
}

function toException(row: ScheduleExceptionRow): ScheduleException {
  return {
    id: row.id,
    habitId: row.habitId,
    startDate: row.startDate,
    endDate: row.endDate,
    kind: row.kind,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function toReminder(row: HabitReminderRow): HabitReminder {
  return {
    id: row.id,
    habitId: row.habitId,
    enabled: row.enabled,
    time: row.time,
    weekdays: row.weekdays ?? [],
    snoozeMinutes: row.snoozeMinutes,
    stopAfterCompletion: row.stopAfterCompletion,
    createdAt: row.createdAt.toISOString(),
  };
}

function logId(userId: string, habitId: string, date: string, occurrence: number): string {
  return `${userId}:${habitId}:${date}:${occurrence}`;
}

async function ensurePreferences(userId: string, executor: DbExecutor = db): Promise<void> {
  await executor
    .insert(userPreferences)
    .values({ userId })
    .onConflictDoNothing();
}

async function getUserTimezone(userId: string, executor: DbExecutor = db): Promise<string> {
  const [user] = await executor
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.timezone ?? "UTC";
}

async function listHabits(userId: string, executor: DbExecutor = db): Promise<Habit[]> {
  const rows = await executor
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(habits.position, habits.createdAt);
  return rows.map(toHabit);
}

async function listSchedules(userId: string, executor: DbExecutor = db): Promise<HabitSchedule[]> {
  const rows = await executor
    .select()
    .from(habitScheduleVersions)
    .where(eq(habitScheduleVersions.userId, userId))
    .orderBy(habitScheduleVersions.habitId, habitScheduleVersions.version);
  return rows.map(toSchedule);
}

async function listExceptions(userId: string, executor: DbExecutor = db): Promise<ScheduleException[]> {
  const rows = await executor
    .select()
    .from(habitScheduleExceptions)
    .where(eq(habitScheduleExceptions.userId, userId))
    .orderBy(habitScheduleExceptions.startDate);
  return rows.map(toException);
}

async function listReminders(userId: string, executor: DbExecutor = db): Promise<HabitReminder[]> {
  const rows = await executor
    .select()
    .from(habitReminders)
    .where(eq(habitReminders.userId, userId))
    .orderBy(habitReminders.time);
  return rows.map(toReminder);
}

async function listLogsForMonth(
  userId: string,
  month: string,
  executor: DbExecutor = db
): Promise<HabitLog[]> {
  const rows = await executor
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        gte(habitLogs.date, `${month}-01`),
        lte(habitLogs.date, `${month}-31`)
      )
    );
  return rows.map(toLog);
}

async function deleteSnapshots(
  userId: string,
  months: string[],
  executor: DbExecutor = db
): Promise<void> {
  if (!months.length) return;
  await executor
    .delete(monthlySnapshots)
    .where(
      and(eq(monthlySnapshots.userId, userId), inArray(monthlySnapshots.month, months))
    );
}

async function deleteAllSnapshots(userId: string, executor: DbExecutor = db): Promise<void> {
  await executor.delete(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
}

async function listAllLogsForUser(userId: string, executor: DbExecutor = db): Promise<HabitLog[]> {
  const rows = await executor
    .select()
    .from(habitLogs)
    .where(eq(habitLogs.userId, userId));
  return rows.map(toLog);
}

async function getProfile(userId: string): Promise<UserProfile> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("Account not found.");

  await ensurePreferences(userId);
  const [preference] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    timezone: user.timezone,
    theme: preference?.theme ?? "dark",
    notificationTime: preference?.notificationTime ?? "08:00",
    onboardingCompleted: preference?.onboardingCompleted ?? false,
    streakPolicy: preference?.streakPolicy ?? "strict",
    remindersEnabled: preference?.remindersEnabled ?? false,
    quietHoursStart: preference?.quietHoursStart ?? "22:00",
    quietHoursEnd: preference?.quietHoursEnd ?? "07:00",
    createdAt: user.createdAt.toISOString(),
  };
}

interface ScheduleSeed {
  cadence: CreateScheduleVersionInput["cadence"];
  weekdays: number[];
  timesPerWeek: number | null;
  intervalDays: number | null;
  monthDay: number | null;
  timesPerDay: number;
  targetValue: number | null;
  unit: string | null;
  targetDurationSeconds: number | null;
  dayStartMinute: number;
  timezone: string;
  effectiveFrom: string;
  anchorDate: string;
}

function buildScheduleValues(
  userId: string,
  habitId: string,
  version: number,
  seed: ScheduleSeed
) {
  return {
    id: ulid(),
    userId,
    habitId,
    version,
    effectiveFrom: seed.effectiveFrom,
    effectiveTo: null,
    cadence: seed.cadence,
    weekdays: seed.weekdays,
    timesPerWeek: seed.timesPerWeek,
    intervalDays: seed.intervalDays,
    monthDay: seed.monthDay,
    timesPerDay: seed.timesPerDay,
    targetValue: seed.targetValue,
    unit: seed.unit,
    targetDurationSeconds: seed.targetDurationSeconds,
    dayStartMinute: seed.dayStartMinute,
    timezone: seed.timezone,
    anchorDate: seed.anchorDate,
    createdAt: new Date(),
  };
}

function scheduleSeedFromInput(
  input: CreateScheduleVersionInput | CreateHabitInput["schedule"],
  habit: Pick<Habit, "kind" | "targetValue" | "unit" | "targetDurationSeconds">,
  timezone: string,
  fallbackDate: string
): ScheduleSeed {
  const seed = input as Partial<CreateScheduleVersionInput> | undefined;
  return {
    cadence: seed?.cadence ?? "daily",
    weekdays: seed?.weekdays ?? [],
    timesPerWeek: seed?.timesPerWeek ?? null,
    intervalDays: seed?.intervalDays ?? null,
    monthDay: seed?.monthDay ?? null,
    timesPerDay: seed?.timesPerDay ?? 1,
    targetValue: seed?.targetValue ?? habit.targetValue,
    unit: seed?.unit ?? habit.unit,
    targetDurationSeconds: seed?.targetDurationSeconds ?? habit.targetDurationSeconds,
    dayStartMinute: seed?.dayStartMinute ?? 0,
    timezone: seed?.timezone ?? timezone,
    effectiveFrom: seed?.effectiveFrom ?? fallbackDate,
    anchorDate: seed?.anchorDate ?? seed?.effectiveFrom ?? fallbackDate,
  };
}

async function nextScheduleVersion(
  userId: string,
  habitId: string,
  executor: DbExecutor = db
): Promise<number> {
  const [result] = await executor
    .select({ value: max(habitScheduleVersions.version) })
    .from(habitScheduleVersions)
    .where(
      and(eq(habitScheduleVersions.userId, userId), eq(habitScheduleVersions.habitId, habitId))
    );
  return (result?.value ?? 0) + 1;
}

async function insertScheduleVersion(
  userId: string,
  habit: Habit,
  input: CreateScheduleVersionInput | CreateHabitInput["schedule"],
  executor: DbExecutor = db
): Promise<HabitSchedule> {
  const timezone = await getUserTimezone(userId, executor);
  const fallbackDate = localDateForInstant(new Date(), timezone, 0);
  const seed = scheduleSeedFromInput(input, habit, timezone, fallbackDate);
  const version = await nextScheduleVersion(userId, habit.id, executor);

  await executor
    .update(habitScheduleVersions)
    .set({ effectiveTo: addDays(seed.effectiveFrom, -1) })
    .where(
      and(
        eq(habitScheduleVersions.userId, userId),
        eq(habitScheduleVersions.habitId, habit.id),
        isNull(habitScheduleVersions.effectiveTo),
        lte(habitScheduleVersions.effectiveFrom, seed.effectiveFrom)
      )
    );

  const values = buildScheduleValues(userId, habit.id, version, seed);
  await executor.insert(habitScheduleVersions).values(values);
  return toSchedule({
    ...values,
    weekdays: values.weekdays,
    createdAt: values.createdAt,
  });
}

export const workspaceRepository = {
  getProfile,
  listHabits,
  listSchedules,
  listExceptions,
  listReminders,

  async getBootstrap(userId: string): Promise<BootstrapData> {
    const [user, habitList, scheduleList, exceptionList, reminderList] = await Promise.all([
      getProfile(userId),
      listHabits(userId),
      listSchedules(userId),
      listExceptions(userId),
      listReminders(userId),
    ]);
    return {
      user,
      habits: habitList,
      schedules: scheduleList,
      exceptions: exceptionList,
      reminders: reminderList,
      pendingLogCount: 0,
    };
  },

  async createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
    await ensurePreferences(userId);
    const [result] = await db.insert(habits).values({
      userId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      color: input.color,
      position: input.order,
      isActive: input.isActive,
      kind: input.kind,
      targetValue: input.targetValue ?? null,
      unit: input.unit ?? null,
      targetDurationSeconds: input.targetDurationSeconds ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    if (!result) throw new Error("Habit insert returned no row.");

    const habit = toHabit(result);
    await insertScheduleVersion(userId, habit, input.schedule);
    return habit;
  },

  async updateHabit(userId: string, habitId: string, input: UpdateHabitInput): Promise<Habit> {
    const [existing] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!existing) throw new NotFoundError("Habit not found.");

    const [result] = await db
      .update(habits)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.order !== undefined ? { position: input.order } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.targetDurationSeconds !== undefined
          ? { targetDurationSeconds: input.targetDurationSeconds }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    if (!result) throw new NotFoundError("Habit not found.");

    if (input.schedule) {
      await insertScheduleVersion(userId, toHabit(result), input.schedule);
    }

    await deleteAllSnapshots(userId);
    return toHabit(result);
  },

  async createScheduleVersion(
    userId: string,
    habitId: string,
    input: CreateScheduleVersionInput
  ): Promise<HabitSchedule> {
    const habit = (await listHabits(userId)).find((candidate) => candidate.id === habitId);
    if (!habit) throw new NotFoundError("Habit not found.");
    const schedule = await insertScheduleVersion(userId, habit, input);
    await deleteAllSnapshots(userId);
    return schedule;
  },

  async createException(
    userId: string,
    habitId: string,
    input: ScheduleExceptionInput
  ): Promise<ScheduleException> {
    const owned = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!owned.length) throw new NotFoundError("Habit not found.");

    const values = {
      id: ulid(),
      userId,
      habitId,
      startDate: input.startDate,
      endDate: input.endDate,
      kind: input.kind,
      reason: input.reason ?? null,
      createdAt: new Date(),
    };
    await db.insert(habitScheduleExceptions).values(values);
    await deleteAllSnapshots(userId);
    return toException(values);
  },

  async deleteException(userId: string, exceptionId: string): Promise<void> {
    const result = await db
      .delete(habitScheduleExceptions)
      .where(
        and(
          eq(habitScheduleExceptions.id, exceptionId),
          eq(habitScheduleExceptions.userId, userId)
        )
      )
      .returning({ id: habitScheduleExceptions.id });
    if (!result.length) throw new NotFoundError("Exception not found.");
    await deleteAllSnapshots(userId);
  },

  async listLogs(userId: string, month: string): Promise<HabitLog[]> {
    return listLogsForMonth(userId, month);
  },

  async upsertLogs(userId: string, logs: UpsertLogsInput): Promise<void> {
    const habitIds = [...new Set(logs.map((log) => log.habitId))];
    const ownedRows = await db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), inArray(habits.id, habitIds)));
    if (ownedRows.length !== habitIds.length) {
      throw new ValidationError("One or more habits are not available for this account.");
    }
    const owned = new Map(ownedRows.map((row) => [row.id, toHabit(row)]));

    const ids = logs.map((log) =>
      logId(userId, log.habitId, log.date, log.occurrence ?? 1)
    );
    const existingRows = ids.length
      ? await db.select().from(habitLogs).where(inArray(habitLogs.id, ids))
      : [];
    const createdAtById = new Map(existingRows.map((row) => [row.id, row.createdAt]));
    const now = new Date();

    await db.insert(habitLogs).values(
      logs.map((log) => {
        const id = logId(userId, log.habitId, log.date, log.occurrence ?? 1);
        const habit = owned.get(log.habitId)!;
        const previousCreatedAt = createdAtById.get(id);
        return {
          id,
          userId,
          habitId: log.habitId,
          date: log.date,
          status: resolveStatus(habit, log.status, log.value),
          occurrence: log.occurrence ?? 1,
          value: log.value ?? null,
          unit: log.unit ?? null,
          note: log.note ?? null,
          source: log.source ?? "manual",
          startedAt: log.startedAt ? new Date(log.startedAt) : null,
          endedAt: log.endedAt ? new Date(log.endedAt) : null,
          createdAt: log.createdAt ? new Date(log.createdAt) : (previousCreatedAt ?? now),
          updatedAt: new Date(log.updatedAt || now.toISOString()),
          editedAt: previousCreatedAt ? now : (log.editedAt ? new Date(log.editedAt) : null),
          isSkip: false,
          plannedBreak: false,
        };
      })
    ).onConflictDoUpdate({
      target: [
        habitLogs.userId,
        habitLogs.habitId,
        habitLogs.date,
        habitLogs.occurrence,
      ],
      set: {
        status: sql`excluded.status`,
        occurrence: sql`excluded.occurrence`,
        value: sql`excluded.value`,
        unit: sql`excluded.unit`,
        note: sql`excluded.note`,
        source: sql`excluded.source`,
        startedAt: sql`excluded.started_at`,
        endedAt: sql`excluded.ended_at`,
        updatedAt: sql`excluded.updated_at`,
        editedAt: sql`excluded.edited_at`,
      },
    });

    await deleteSnapshots(userId, [...new Set(logs.map((log) => log.date.slice(0, 7)))]);
  },

  /** Explicit undo: removes a check-in so the scheduled day returns to pending. */
  async deleteLog(userId: string, input: DeleteLogInput): Promise<void> {
    const result = await db
      .delete(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, userId),
          eq(habitLogs.habitId, input.habitId),
          eq(habitLogs.date, input.date),
          eq(habitLogs.occurrence, input.occurrence ?? 1)
        )
      )
      .returning({ id: habitLogs.id });
    if (!result.length) throw new NotFoundError("Check-in not found.");
    await deleteSnapshots(userId, [input.date.slice(0, 7)]);
  },

  async upsertReminder(
    userId: string,
    habitId: string,
    input: HabitReminderInput
  ): Promise<HabitReminder> {
    const owned = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!owned.length) throw new NotFoundError("Habit not found.");

    const [existing] = await db
      .select()
      .from(habitReminders)
      .where(
        and(eq(habitReminders.userId, userId), eq(habitReminders.habitId, habitId))
      )
      .limit(1);
    const now = new Date();
    const values = {
      userId,
      habitId,
      enabled: input.enabled,
      time: input.time,
      weekdays: input.weekdays,
      snoozeMinutes: input.snoozeMinutes,
      stopAfterCompletion: input.stopAfterCompletion,
      updatedAt: now,
    };

    if (existing) {
      const [updated] = await db
        .update(habitReminders)
        .set(values)
        .where(eq(habitReminders.id, existing.id))
        .returning();
      return toReminder(updated!);
    }

    const [created] = await db
      .insert(habitReminders)
      .values({ id: ulid(), ...values, createdAt: now })
      .returning();
    return toReminder(created!);
  },

  async getSnapshot(userId: string, month: string): Promise<MonthlySnapshot> {
    const [existing] = await db
      .select()
      .from(monthlySnapshots)
      .where(
        and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.month, month))
      )
      .limit(1);
    if (existing) return JSON.parse(existing.payload) as MonthlySnapshot;

    const [habitList, logs, scheduleList, exceptionList] = await Promise.all([
      listHabits(userId),
      listLogsForMonth(userId, month),
      listSchedules(userId),
      listExceptions(userId),
    ]);
    const snapshot = buildMonthlySnapshot(
      month,
      habitList,
      logs,
      new Date(),
      { schedules: scheduleList, exceptions: exceptionList }
    );
    await db.insert(monthlySnapshots).values({
      userId,
      month,
      payload: JSON.stringify(snapshot),
      generatedAt: new Date(snapshot.generatedAt),
    }).onConflictDoNothing();
    return snapshot;
  },

  async deleteSnapshot(userId: string, month: string): Promise<void> {
    await deleteSnapshots(userId, [month]);
  },

  async deleteAllSnapshots(userId: string): Promise<void> {
    await deleteAllSnapshots(userId);
  },

  async getScheduledOpportunities(
    userId: string,
    start: string,
    end: string
  ): Promise<ScheduledOpportunity[]> {
    return scheduledOpportunitiesForRange(
      await listSchedules(userId),
      await listExceptions(userId),
      start,
      end
    );
  },

  async getAnalyticsRange(userId: string, months = 12): Promise<AnalyticsRangeData> {
    const now = new Date();
    const monthList = Array.from({ length: months }, (_, index) =>
      toMonthString(new Date(now.getFullYear(), now.getMonth() - index, 1))
    ).reverse();
    const start = `${monthList[0]}-01`;
    const end = `${monthList[monthList.length - 1]}-31`;
    const rows = await db
      .select()
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.userId, userId),
          gte(habitLogs.date, start),
          lte(habitLogs.date, end)
        )
      );
    const [habitList, scheduleList, exceptionList] = await Promise.all([
      listHabits(userId),
      listSchedules(userId),
      listExceptions(userId),
    ]);
    return {
      habits: habitList,
      logs: rows.map(toLog),
      schedules: scheduleList,
      exceptions: exceptionList,
      months: monthList,
    };
  },

  listAllLogs: listAllLogsForUser,

  async completeOnboarding(userId: string, mode: "defaults" | "scratch"): Promise<Habit[]> {
    await ensurePreferences(userId);
    const existing = await listHabits(userId);
    if (mode === "defaults" && !existing.some((habit) => habit.isActive)) {
      const now = new Date();
      const timezone = await getUserTimezone(userId);
      const effectiveFrom = localDateForInstant(now, timezone, 0);
      const defaults = buildDefaultHabits(() => ulid(), now);
      await db.insert(habits).values(
        defaults.map((habit) => ({
          id: habit.id,
          userId,
          name: habit.name,
          description: habit.description,
          category: habit.category,
          color: habit.color,
          position: habit.order,
          isActive: true,
          kind: habit.kind,
          targetValue: habit.targetValue,
          unit: habit.unit,
          targetDurationSeconds: habit.targetDurationSeconds,
          createdAt: now,
          updatedAt: now,
        }))
      );
      await db.insert(habitScheduleVersions).values(
        defaults.map((habit) =>
          buildScheduleValues(userId, habit.id, 1, {
            cadence: "daily",
            weekdays: [],
            timesPerWeek: null,
            intervalDays: null,
            monthDay: null,
            timesPerDay: 1,
            targetValue: habit.targetValue,
            unit: habit.unit,
            targetDurationSeconds: habit.targetDurationSeconds,
            dayStartMinute: 0,
            timezone,
            effectiveFrom,
            anchorDate: effectiveFrom,
          })
        )
      );
    }
    await db.update(userPreferences)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId));
    return listHabits(userId);
  },

  async updateProfile(userId: string, patch: ProfilePatchInput): Promise<UserProfile> {
    await db.update(users).set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
    return getProfile(userId);
  },

  async updatePreferences(
    userId: string,
    patch: PreferencesPatchSchemaType
  ): Promise<UserProfile> {
    await ensurePreferences(userId);
    await db.update(userPreferences).set({
      ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      ...(patch.notificationTime !== undefined ? { notificationTime: patch.notificationTime } : {}),
      ...(patch.onboardingCompleted !== undefined
        ? { onboardingCompleted: patch.onboardingCompleted }
        : {}),
      ...(patch.streakPolicy !== undefined ? { streakPolicy: patch.streakPolicy } : {}),
      ...(patch.remindersEnabled !== undefined ? { remindersEnabled: patch.remindersEnabled } : {}),
      ...(patch.quietHoursStart !== undefined ? { quietHoursStart: patch.quietHoursStart } : {}),
      ...(patch.quietHoursEnd !== undefined ? { quietHoursEnd: patch.quietHoursEnd } : {}),
      updatedAt: new Date(),
    }).where(eq(userPreferences.userId, userId));
    return getProfile(userId);
  },

  async getWorkspaceBackup(userId: string) {
    const [profile, habitList, scheduleList, exceptionList, logList, reminderList, noteRows] =
      await Promise.all([
        getProfile(userId),
        listHabits(userId),
        listSchedules(userId),
        listExceptions(userId),
        listAllLogsForUser(userId),
        listReminders(userId),
        db
          .select({
            weekStart: weeklyReviews.weekStart,
            note: weeklyReviews.note,
            updatedAt: weeklyReviews.updatedAt,
          })
          .from(weeklyReviews)
          .where(eq(weeklyReviews.userId, userId)),
      ]);
    return buildWorkspaceBackup({
      profile,
      habits: habitList,
      schedules: scheduleList,
      exceptions: exceptionList,
      logs: logList,
      reminders: reminderList,
      weeklyNotes: noteRows.map((row) => ({
        weekStart: row.weekStart,
        note: row.note,
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  },

  /**
   * Full restore replaces the current workspace. All writes happen in one
   * transaction and habit ids are remapped so no stale references survive.
   */
  async restoreWorkspace(userId: string, backup: WorkspaceBackupInput): Promise<void> {
    await ensurePreferences(userId);
    const [issue] = validateBackupIntegrity(backup);
    if (issue) throw new ValidationError(issue);

    await db.transaction(async (tx) => {
      await tx.delete(habitLogs).where(eq(habitLogs.userId, userId));
      await tx.delete(habitReminders).where(eq(habitReminders.userId, userId));
      await tx.delete(habitScheduleExceptions).where(eq(habitScheduleExceptions.userId, userId));
      await tx.delete(habitScheduleVersions).where(eq(habitScheduleVersions.userId, userId));
      await tx.delete(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
      await tx.delete(weeklyReviews).where(eq(weeklyReviews.userId, userId));
      await tx.delete(habits).where(eq(habits.userId, userId));

      const habitIdMap = new Map<string, string>();
      for (const habit of backup.habits) {
        const id = ulid();
        habitIdMap.set(habit.id, id);
        await tx.insert(habits).values({
          id,
          userId,
          name: habit.name,
          description: habit.description,
          category: habit.category,
          color: habit.color,
          position: habit.order,
          isActive: habit.isActive,
          kind: habit.kind,
          targetValue: habit.targetValue,
          unit: habit.unit,
          targetDurationSeconds: habit.targetDurationSeconds,
          createdAt: new Date(habit.createdAt),
          updatedAt: new Date(habit.createdAt),
        });
      }

      for (const schedule of backup.schedules) {
        await tx.insert(habitScheduleVersions).values({
          id: ulid(),
          userId,
          habitId: habitIdMap.get(schedule.habitId)!,
          version: schedule.version,
          effectiveFrom: schedule.effectiveFrom,
          effectiveTo: schedule.effectiveTo,
          cadence: schedule.cadence,
          weekdays: schedule.weekdays,
          timesPerWeek: schedule.timesPerWeek,
          intervalDays: schedule.intervalDays,
          monthDay: schedule.monthDay,
          timesPerDay: schedule.timesPerDay,
          targetValue: schedule.targetValue,
          unit: schedule.unit,
          targetDurationSeconds: schedule.targetDurationSeconds,
          dayStartMinute: schedule.dayStartMinute,
          timezone: schedule.timezone,
          anchorDate: schedule.anchorDate,
          createdAt: new Date(schedule.createdAt),
        });
      }

      for (const item of backup.exceptions) {
        await tx.insert(habitScheduleExceptions).values({
          id: ulid(),
          userId,
          habitId: habitIdMap.get(item.habitId)!,
          startDate: item.startDate,
          endDate: item.endDate,
          kind: item.kind,
          reason: item.reason,
          createdAt: new Date(item.createdAt),
        });
      }

      const now = new Date();
      for (const log of backup.logs) {
        const habitId = habitIdMap.get(log.habitId)!;
        const occurrence = log.occurrence ?? 1;
        await tx.insert(habitLogs).values({
          id: logId(userId, habitId, log.date, occurrence),
          userId,
          habitId,
          date: log.date,
          status: log.status,
          occurrence,
          value: log.value,
          unit: log.unit,
          note: log.note,
          source: log.source ?? "manual",
          startedAt: log.startedAt ? new Date(log.startedAt) : null,
          endedAt: log.endedAt ? new Date(log.endedAt) : null,
          createdAt: log.createdAt ? new Date(log.createdAt) : now,
          updatedAt: new Date(log.updatedAt),
          editedAt: log.editedAt ? new Date(log.editedAt) : null,
          isSkip: false,
          plannedBreak: false,
        });
      }

      for (const reminder of backup.reminders) {
        await tx.insert(habitReminders).values({
          id: ulid(),
          userId,
          habitId: habitIdMap.get(reminder.habitId)!,
          enabled: reminder.enabled,
          time: reminder.time,
          weekdays: reminder.weekdays,
          snoozeMinutes: reminder.snoozeMinutes,
          stopAfterCompletion: reminder.stopAfterCompletion,
          createdAt: new Date(reminder.createdAt),
          updatedAt: now,
        });
      }

      for (const item of backup.weeklyNotes) {
        await tx.insert(weeklyReviews).values({
          userId,
          weekStart: item.weekStart,
          note: item.note,
          updatedAt: new Date(item.updatedAt),
        });
      }

      await tx.update(users)
        .set({ timezone: backup.profile.timezone, updatedAt: now })
        .where(eq(users.id, userId));
      await tx.update(userPreferences)
        .set({
          streakPolicy: backup.profile.streakPolicy,
          notificationTime: backup.profile.notificationTime,
          remindersEnabled: backup.profile.remindersEnabled,
          quietHoursStart: backup.profile.quietHoursStart,
          quietHoursEnd: backup.profile.quietHoursEnd,
          updatedAt: now,
        })
        .where(eq(userPreferences.userId, userId));
    });
  },

  async nextHabitPosition(userId: string): Promise<number> {
    const [result] = await db
      .select({ value: max(habits.position) })
      .from(habits)
      .where(eq(habits.userId, userId));
    return (result?.value ?? -1) + 1;
  },
};
