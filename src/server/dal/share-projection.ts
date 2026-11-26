import { and, desc, eq } from "drizzle-orm";
import { buildSharePreview } from "@/domain/sharing";
import type { ShareGrant, SharePreview } from "@/domain/types";
import { db } from "@/server/db";
import {
  habitLogs,
  habits,
  shareGrants,
  type HabitLogRow,
  type HabitRow,
} from "@/server/db/schema";

type ShareGrantRow = typeof shareGrants.$inferSelect;

export function toShareGrant(row: ShareGrantRow): ShareGrant {
  return {
    id: row.id,
    ownerId: row.userId,
    audience: row.audience,
    recipientId: row.recipientUserId,
    circleId: row.circleId,
    habitId: row.habitId,
    alias: row.alias,
    fields: row.fields,
    frequency: row.frequency,
    consentVersion: row.consentVersion,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shared previews always read the owner's habit and newest log, never a raw request body. */
export async function loadSharePreviewData(userId: string, habitId: string) {
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, habitId)))
    .limit(1);
  if (!habit) throw new Error("Habit not found for share preview.");

  const [latestLog] = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId)))
    .orderBy(desc(habitLogs.updatedAt))
    .limit(1);

  return { habit, latestLog };
}

function toHabit(row: HabitRow) {
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

function toLatestLog(row: HabitLogRow | undefined) {
  if (!row) return undefined;
  return {
    habitId: row.habitId,
    date: row.date,
    status: row.status as 0 | 0.5 | 1,
    updatedAt: row.updatedAt.toISOString(),
    value: row.value,
    unit: row.unit,
    note: row.note,
  };
}

export function previewFromGrant(
  grant: ShareGrant,
  data: Awaited<ReturnType<typeof loadSharePreviewData>>
): SharePreview {
  return buildSharePreview({
    grant,
    habit: toHabit(data.habit),
    latestLog: toLatestLog(data.latestLog),
  });
}
