import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { revokeGrant } from "@/domain/sharing";
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
  circleMemberships,
  habits,
  publicChallenges,
  safetyControls,
  safetyReports,
  shareGrants,
  users,
} from "@/server/db/schema";
import { circleRepository } from "./circle-repository";
import { NotFoundError, ValidationError } from "./errors";
import { partnerInviteRepository } from "./partner-invite-repository";
import {
  loadSharePreviewData,
  previewFromGrant,
  toShareGrant,
} from "./share-projection";

type ShareGrantRow = typeof shareGrants.$inferSelect;
type SafetyControlRow = typeof safetyControls.$inferSelect;
type SafetyReportRow = typeof safetyReports.$inferSelect;

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
    reviewedByUserId: row.reviewedByUserId,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
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

/** Boundaries and reports may only target someone already connected by consent. */
async function isConsentedTarget(actorId: string, targetId: string): Promise<boolean> {
  if (await partnerInviteRepository.hasAcceptedLink(actorId, targetId)) return true;

  const myCircles = await db
    .select({ circleId: circleMemberships.circleId })
    .from(circleMemberships)
    .where(eq(circleMemberships.userId, actorId));
  if (!myCircles.length) return false;

  const shared = await db
    .select({ circleId: circleMemberships.circleId })
    .from(circleMemberships)
    .where(
      and(
        eq(circleMemberships.userId, targetId),
        inArray(circleMemberships.circleId, myCircles.map((row) => row.circleId))
      )
    )
    .limit(1);
  return shared.length > 0;
}

export const socialRepository = {
  async listShareGrants(userId: string): Promise<ShareGrant[]> {
    const rows = await db
      .select()
      .from(shareGrants)
      .where(eq(shareGrants.userId, userId))
      .orderBy(desc(shareGrants.createdAt));
    return rows.map(toShareGrant);
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
      if (!(await partnerInviteRepository.hasAcceptedLink(userId, input.recipientId))) {
        throw new ValidationError("The partner invite must be accepted before sharing.");
      }
    }
    if (input.audience === "circle") {
      if (!input.circleId) throw new ValidationError("A circle is required.");
      if (!(await circleRepository.hasActiveMembership(userId, input.circleId))) {
        throw new ValidationError("You must be an active circle member before sharing.");
      }
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
    return toShareGrant(row!);
  },

  async getSharePreview(userId: string, grantId: string): Promise<SharePreview> {
    const row = await findOwnedGrant(userId, grantId);
    return previewFromGrant(toShareGrant(row), await loadSharePreviewData(userId, row.habitId));
  },

  /** Dry run: shows the exact fields before any grant is persisted. */
  async previewShareGrant(
    userId: string,
    input: ShareGrantInput
  ): Promise<SharePreview> {
    if (input.audience === "partner") {
      if (!input.recipientId) throw new ValidationError("Choose a partner first.");
      if (!(await partnerInviteRepository.hasAcceptedLink(userId, input.recipientId))) {
        throw new ValidationError("The invite must be accepted before sharing.");
      }
    }
    if (input.audience === "circle") {
      if (!input.circleId || !(await circleRepository.hasActiveMembership(userId, input.circleId))) {
        throw new ValidationError("You must be an active circle member before sharing.");
      }
    }
    const now = new Date().toISOString();
    const draft: ShareGrant = {
      id: "preview",
      ownerId: userId,
      audience: input.audience,
      recipientId: input.audience === "partner" ? input.recipientId! : null,
      circleId: input.audience === "circle" ? input.circleId! : null,
      habitId: input.habitId,
      alias: input.alias ?? null,
      fields: input.fields,
      frequency: input.frequency,
      consentVersion: input.consentVersion,
      startsAt: input.startsAt ?? now,
      endsAt: input.endsAt ?? null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    return previewFromGrant(draft, await loadSharePreviewData(userId, input.habitId));
  },

  async revokeShareGrant(userId: string, grantId: string): Promise<ShareGrant> {
    const row = await findOwnedGrant(userId, grantId);
    if (row.revokedAt) return toShareGrant(row);
    const revoked = revokeGrant(toShareGrant(row));
    const [updated] = await db
      .update(shareGrants)
      .set({
        revokedAt: new Date(revoked.revokedAt!),
        updatedAt: new Date(revoked.updatedAt),
      })
      .where(eq(shareGrants.id, row.id))
      .returning();
    return toShareGrant(updated!);
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
      if (!(await isConsentedTarget(userId, input.targetUserId!))) {
        throw new ValidationError("You can only set boundaries with a connected partner or circle member.");
      }
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
    if (input.targetType === "public_challenge") {
      if (input.targetUserId) {
        throw new ValidationError("Public challenge reports do not name a user.");
      }
      const [challenge] = await db
        .select({ id: publicChallenges.id, status: publicChallenges.status })
        .from(publicChallenges)
        .where(eq(publicChallenges.id, input.targetId))
        .limit(1);
      if (!challenge || challenge.status !== "active") {
        throw new NotFoundError("Challenge not found.");
      }
    } else if (input.targetUserId) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);
      if (!target) throw new NotFoundError("User not found.");
      if (!(await isConsentedTarget(userId, input.targetUserId!))) {
        throw new ValidationError("You can only report a connected partner or circle member.");
      }
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
