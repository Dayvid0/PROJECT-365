import { and, eq, gte, inArray, lte, max, sql } from "drizzle-orm";
import { ulid } from "ulidx";
import { buildDefaultHabits } from "@/domain/defaults";
import { buildMonthlySnapshot, toMonthString } from "@/domain/calculations";
import type {
  AnalyticsRangeData,
  BootstrapData,
  Habit,
  HabitLog,
  MonthlySnapshot,
  UserProfile,
} from "@/domain/types";
import type {
  CreateHabitInput,
  PreferencesPatchSchemaType,
  ProfilePatchInput,
  UpdateHabitInput,
  UpsertLogsInput,
} from "@/domain/validation";
import { db, type DbExecutor } from "@/server/db";
import {
  habitLogs,
  habits,
  monthlySnapshots,
  userPreferences,
  users,
  type HabitLogRow,
  type HabitRow,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    order: row.position,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    color: row.color,
  };
}

function toLog(row: HabitLogRow): HabitLog {
  return {
    habitId: row.habitId,
    date: row.date,
    status: row.status as HabitLog["status"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

function logId(userId: string, habitId: string, date: string): string {
  return `${userId}:${habitId}:${date}`;
}

async function ensurePreferences(userId: string, executor: DbExecutor = db): Promise<void> {
  await executor
    .insert(userPreferences)
    .values({ userId })
    .onConflictDoNothing();
}

async function listHabits(userId: string, executor: DbExecutor = db): Promise<Habit[]> {
  const rows = await executor
    .select()
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(habits.position, habits.createdAt);
  return rows.map(toHabit);
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
    createdAt: user.createdAt.toISOString(),
  };
}

export const workspaceRepository = {
  getProfile,
  listHabits,

  async getBootstrap(userId: string): Promise<BootstrapData> {
    const [user, habitList] = await Promise.all([getProfile(userId), listHabits(userId)]);
    return { user, habits: habitList, pendingLogCount: 0 };
  },

  async createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
    await ensurePreferences(userId);
    const [result] = await db.insert(habits).values({
      userId,
      name: input.name,
      category: input.category,
      color: input.color,
      position: input.order,
      isActive: input.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    if (!result) throw new Error("Habit insert returned no row.");
    return toHabit(result);
  },

  async updateHabit(userId: string, habitId: string, input: UpdateHabitInput): Promise<Habit> {
    const [result] = await db
      .update(habits)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.order !== undefined ? { position: input.order } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    if (!result) throw new NotFoundError("Habit not found.");

    await db.delete(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
    return toHabit(result);
  },

  async listLogs(userId: string, month: string): Promise<HabitLog[]> {
    return listLogsForMonth(userId, month);
  },

  async upsertLogs(userId: string, logs: UpsertLogsInput): Promise<void> {
    const habitIds = [...new Set(logs.map((log) => log.habitId))];
    const owned = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.userId, userId), inArray(habits.id, habitIds)));
    if (owned.length !== habitIds.length) {
      throw new ValidationError("One or more habits are not available for this account.");
    }

    const now = new Date();
    await db.insert(habitLogs).values(
      logs.map((log) => ({
        id: logId(userId, log.habitId, log.date),
        userId,
        habitId: log.habitId,
        date: log.date,
        status: log.status,
        updatedAt: new Date(log.updatedAt || now.toISOString()),
      }))
    ).onConflictDoUpdate({
      target: habitLogs.id,
      set: {
        status: sql`excluded.status`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

    await deleteSnapshots(userId, [...new Set(logs.map((log) => log.date.slice(0, 7)))]);
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

    const [habitList, logs] = await Promise.all([
      listHabits(userId),
      listLogsForMonth(userId, month),
    ]);
    const snapshot = buildMonthlySnapshot(month, habitList, logs);
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
    await db.delete(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
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
    return { habits: await listHabits(userId), logs: rows.map(toLog), months: monthList };
  },

  async listAllLogs(userId: string): Promise<HabitLog[]> {
    const rows = await db
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.userId, userId));
    return rows.map(toLog);
  },

  async completeOnboarding(userId: string, mode: "defaults" | "scratch"): Promise<Habit[]> {
    await ensurePreferences(userId);
    const existing = await listHabits(userId);
    if (mode === "defaults" && !existing.some((habit) => habit.isActive)) {
      const now = new Date();
      const defaults = buildDefaultHabits(() => ulid(), now);
      await db.insert(habits).values(
        defaults.map((habit) => ({
          id: habit.id,
          userId,
          name: habit.name,
          category: habit.category,
          color: habit.color,
          position: habit.order,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }))
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
      updatedAt: new Date(),
    }).where(eq(userPreferences.userId, userId));
    return getProfile(userId);
  },

  async nextHabitPosition(userId: string): Promise<number> {
    const [result] = await db
      .select({ value: max(habits.position) })
      .from(habits)
      .where(eq(habits.userId, userId));
    return (result?.value ?? -1) + 1;
  },
};
