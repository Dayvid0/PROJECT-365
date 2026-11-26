import { and, desc, eq, isNull } from "drizzle-orm";
import { buildSharePreview, revokeGrant } from "@/domain/sharing";
import type {
  SafetyControl,
  SafetyReport,
  ShareGrant,
  SharePreview,
} from "@/domain/types";
import type {
  SafetyControlInput,
  SafetyReportInput,
  ShareGrantInput,
} from "@/domain/validation";
import { db } from "@/server/db";
import {
  habitLogs,
  habits,
  safetyControls,
  safetyReports,
  shareGrants,
  users,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

type ShareGrantRow = typeof shareGrants.$inferSelect;
type SafetyControlRow = typeof safetyControls.$inferSelect;
type SafetyReportRow = typeof safetyReports.$inferSelect;

function toGrant(row: ShareGrantRow): ShareGrant {
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

function toControl(row: SafetyControlRow): SafetyControl {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    targetUserId: row.targetUserId,
    circleId: row.circleId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

function toReport(row: SafetyReportRow): SafetyReport {
  return {
    id: row.id,
    reporterId: row.reporterUserId,
    targetType: row.targetType,
    targetId: row.targetId,
    targetUserId: row.targetUserId,
    category: row.category,
    detail: row.detail,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findOwnedGrant(userId: string, grantId: string): Promise<ShareGrantRow> {
  const [row] = await db
    .select()
    .from(shareGrants)
    .where(and(eq(shareGrants.id, grantId), eq(shareGrants.userId, userId)))
    .limit(1);
  if (!row) throw new NotFoundError("Share grant not found.");
  return row;
}

export const socialRepository = {
  async listShareGrants(userId: string): Promise<ShareGrant[]> {
    const rows = await db
      .select()
      .from(shareGrants)
      .where(eq(shareGrants.userId, userId))
      .orderBy(desc(shareGrants.createdAt));
    return rows.map(toGrant);
  },

  async createShareGrant(userId: string, input: ShareGrantInput): Promise<ShareGrant> {
    const [habit] = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, input.habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!habit) throw new NotFoundError("Habit not found.");

    if (input.audience === "partner") {
      if (!input.recipientId) throw new ValidationError("A partner is required.");
      if (input.recipientId === userId) {
        throw new ValidationError("You cannot share with yourself.");
      }
      const [recipient] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.recipientId))
        .limit(1);
      if (!recipient) throw new NotFoundError("Partner not found.");
    }
    if (input.audience === "circle" && !input.circleId) {
      throw new ValidationError("A circle is required.");
    }

    const duplicateTarget =
      input.audience === "partner"
        ? eq(shareGrants.recipientUserId, input.recipientId!)
        : eq(shareGrants.circleId, input.circleId!);
    const [existing] = await db
      .select({ id: shareGrants.id })
      .from(shareGrants)
      .where(
        and(
          eq(shareGrants.userId, userId),
          eq(shareGrants.habitId, input.habitId),
          eq(shareGrants.audience, input.audience),
          duplicateTarget,
          isNull(shareGrants.revokedAt)
        )
      )
      .limit(1);
    if (existing) {
      throw new ValidationError("An active grant for this audience and habit already exists.");
    }

    const now = new Date();
    const [row] = await db
      .insert(shareGrants)
      .values({
        userId,
        audience: input.audience,
        habitId: input.habitId,
        recipientUserId: input.audience === "partner" ? input.recipientId! : null,
        circleId: input.audience === "circle" ? input.circleId! : null,
        alias: input.alias ?? null,
        fields: input.fields,
        frequency: input.frequency,
        consentVersion: input.consentVersion,
        startsAt: input.startsAt ? new Date(input.startsAt) : now,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toGrant(row!);
  },

  async getSharePreview(userId: string, grantId: string): Promise<SharePreview> {
    const row = await findOwnedGrant(userId, grantId);
    const [habit] = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, row.habitId), eq(habits.userId, userId)))
      .limit(1);
    if (!habit) throw new NotFoundError("Habit not found.");

    const [latestLog] = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, row.habitId)))
      .orderBy(desc(habitLogs.updatedAt))
      .limit(1);

    return buildSharePreview({
      grant: toGrant(row),
      habit: {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        category: habit.category,
        order: habit.position,
        isActive: habit.isActive,
        createdAt: habit.createdAt.toISOString(),
        color: habit.color,
        kind: habit.kind,
        targetValue: habit.targetValue,
        unit: habit.unit,
        targetDurationSeconds: habit.targetDurationSeconds,
      },
      latestLog: latestLog
        ? {
            habitId: latestLog.habitId,
            date: latestLog.date,
            status: latestLog.status as 0 | 0.5 | 1,
            updatedAt: latestLog.updatedAt.toISOString(),
            value: latestLog.value,
            unit: latestLog.unit,
            note: latestLog.note,
          }
        : undefined,
    });
  },

  async revokeShareGrant(userId: string, grantId: string): Promise<ShareGrant> {
    const row = await findOwnedGrant(userId, grantId);
    if (row.revokedAt) return toGrant(row);
    const revoked = revokeGrant(toGrant(row));
    const [updated] = await db
      .update(shareGrants)
      .set({
        revokedAt: new Date(revoked.revokedAt!),
        updatedAt: new Date(revoked.updatedAt),
      })
      .where(eq(shareGrants.id, row.id))
      .returning();
    return toGrant(updated!);
  },

  async listSafetyControls(userId: string): Promise<SafetyControl[]> {
    const rows = await db
      .select()
      .from(safetyControls)
      .where(eq(safetyControls.userId, userId))
      .orderBy(desc(safetyControls.createdAt));
    return rows.map(toControl);
  },

  async setSafetyControl(
    userId: string,
    input: SafetyControlInput
  ): Promise<SafetyControl> {
    if (input.kind !== "leave" && input.targetUserId === userId) {
      throw new ValidationError("You cannot block or mute yourself.");
    }
    if (input.targetUserId) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);
      if (!target) throw new NotFoundError("User not found.");
    }

    const targetMatch =
      input.kind === "leave"
        ? eq(safetyControls.circleId, input.circleId!)
        : eq(safetyControls.targetUserId, input.targetUserId!);
    const [existing] = await db
      .select()
      .from(safetyControls)
      .where(and(eq(safetyControls.userId, userId), eq(safetyControls.kind, input.kind), targetMatch))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(safetyControls)
        .set({ expiresAt: input.expiresAt ? new Date(input.expiresAt) : null })
        .where(eq(safetyControls.id, existing.id))
        .returning();
      return toControl(updated!);
    }

    const [row] = await db
      .insert(safetyControls)
      .values({
        userId,
        kind: input.kind,
        targetUserId: input.targetUserId ?? null,
        circleId: input.circleId ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();
    return toControl(row!);
  },

  async removeSafetyControl(userId: string, id: string): Promise<void> {
    const result = await db
      .delete(safetyControls)
      .where(and(eq(safetyControls.id, id), eq(safetyControls.userId, userId)))
      .returning({ id: safetyControls.id });
    if (!result.length) throw new NotFoundError("Safety control not found.");
  },

  async listSafetyReports(userId: string): Promise<SafetyReport[]> {
    const rows = await db
      .select()
      .from(safetyReports)
      .where(eq(safetyReports.reporterUserId, userId))
      .orderBy(desc(safetyReports.createdAt));
    return rows.map(toReport);
  },

  async createSafetyReport(
    userId: string,
    input: SafetyReportInput
  ): Promise<SafetyReport> {
    if (input.targetUserId === userId) {
      throw new ValidationError("You cannot report yourself.");
    }
    if (input.targetUserId) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);
      if (!target) throw new NotFoundError("User not found.");
    }

    const now = new Date();
    const [row] = await db
      .insert(safetyReports)
      .values({
        reporterUserId: userId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: input.targetUserId ?? null,
        category: input.category,
        detail: input.detail,
        status: "open",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toReport(row!);
  },
};
