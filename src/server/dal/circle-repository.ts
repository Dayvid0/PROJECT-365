import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  canAcceptCircleInvite,
  canDeleteCircle,
  canManageCircle,
  canRemoveCircleMember,
  canSetCircleMemberRole,
} from "@/domain/circles";
import { isGrantActive, isSafetyControlActive } from "@/domain/sharing";
import type {
  Circle,
  CircleInvite,
  CircleMember,
  CircleSharedUpdate,
  CircleSummary,
} from "@/domain/types";
import type {
  CircleCreateInput,
  CircleInviteInput,
  CirclePatchInput,
  CircleRoleInput,
} from "@/domain/validation";
import { db } from "@/server/db";
import {
  circleInvites,
  circleMemberships,
  circles,
  safetyControls,
  shareGrants,
  users,
} from "@/server/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import {
  loadSharePreviewData,
  previewFromGrant,
  toShareGrant,
} from "./share-projection";

type CircleRow = typeof circles.$inferSelect;
type MembershipRow = typeof circleMemberships.$inferSelect;
type InviteRow = typeof circleInvites.$inferSelect;

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toCircle(row: CircleRow): Circle {
  return {
    id: row.id,
    ownerId: row.ownerUserId,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toInvite(
  row: InviteRow,
  circleName: string,
  inviterName: string
): CircleInvite {
  return {
    id: row.id,
    circleId: row.circleId,
    circleName,
    inviterId: row.inviterUserId,
    inviterName,
    inviteeEmail: row.inviteeEmail,
    inviteeId: row.inviteeUserId,
    token: row.token,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireMembership(userId: string, circleId: string): Promise<MembershipRow> {
  const [row] = await db
    .select()
    .from(circleMemberships)
    .where(
      and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId))
    )
    .limit(1);
  // Non-members get the same answer as a missing circle: no existence leak.
  if (!row) throw new NotFoundError("Circle not found.");
  return row;
}

async function requireManager(userId: string, circleId: string): Promise<MembershipRow> {
  const membership = await requireMembership(userId, circleId);
  if (!canManageCircle(membership.role)) {
    throw new ForbiddenError("Only circle owners and admins can manage invitations and members.");
  }
  return membership;
}

async function circleName(circleId: string): Promise<string> {
  const [row] = await db
    .select({ name: circles.name })
    .from(circles)
    .where(eq(circles.id, circleId))
    .limit(1);
  if (!row) throw new NotFoundError("Circle not found.");
  return row.name;
}

async function findInvite(inviteId: string) {
  const [row] = await db
    .select({
      invite: circleInvites,
      circleName: circles.name,
      inviterName: users.name,
    })
    .from(circleInvites)
    .innerJoin(circles, eq(circleInvites.circleId, circles.id))
    .innerJoin(users, eq(circleInvites.inviterUserId, users.id))
    .where(eq(circleInvites.id, inviteId))
    .limit(1);
  if (!row) throw new NotFoundError("Circle invite not found.");
  return row;
}

export const circleRepository = {
  async listCircles(userId: string): Promise<CircleSummary[]> {
    const rows = await db
      .select({
        circle: circles,
        role: circleMemberships.role,
        joinedAt: circleMemberships.joinedAt,
      })
      .from(circleMemberships)
      .innerJoin(circles, eq(circleMemberships.circleId, circles.id))
      .where(eq(circleMemberships.userId, userId))
      .orderBy(desc(circles.createdAt));
    if (!rows.length) return [];

    const counts = await db
      .select({
        circleId: circleMemberships.circleId,
        count: sql<number>`count(*)`,
      })
      .from(circleMemberships)
      .where(
        inArray(
          circleMemberships.circleId,
          rows.map((row) => row.circle.id)
        )
      )
      .groupBy(circleMemberships.circleId);
    const byCircle = new Map(counts.map((row) => [row.circleId, Number(row.count)]));

    return rows.map((row) => ({
      id: row.circle.id,
      name: row.circle.name,
      description: row.circle.description,
      role: row.role,
      memberCount: byCircle.get(row.circle.id) ?? 1,
      createdAt: row.circle.createdAt.toISOString(),
    }));
  },

  async getCircleDetail(
    userId: string,
    circleId: string
  ): Promise<CircleSummary & { members: CircleMember[]; invites: CircleInvite[] }> {
    const [row] = await db
      .select({
        circle: circles,
        role: circleMemberships.role,
      })
      .from(circleMemberships)
      .innerJoin(circles, eq(circleMemberships.circleId, circles.id))
      .where(
        and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId))
      )
      .limit(1);
    if (!row) throw new NotFoundError("Circle not found.");

    const [members, invites, counts] = await Promise.all([
      db
        .select({
          circleId: circleMemberships.circleId,
          userId: circleMemberships.userId,
          role: circleMemberships.role,
          joinedAt: circleMemberships.joinedAt,
          name: users.name,
        })
        .from(circleMemberships)
        .innerJoin(users, eq(circleMemberships.userId, users.id))
        .where(eq(circleMemberships.circleId, circleId))
        .orderBy(circleMemberships.joinedAt),
      // Invitation management is owner/admin-only; ordinary members must still
      // be able to open their own circle without leaking invitation details.
      canManageCircle(row.role) ? this.listInvites(userId, circleId) : Promise.resolve([]),
      db
        .select({ count: sql<number>`count(*)` })
        .from(circleMemberships)
        .where(eq(circleMemberships.circleId, circleId)),
    ]);

    return {
      id: row.circle.id,
      name: row.circle.name,
      description: row.circle.description,
      role: row.role,
      memberCount: Number(counts[0]?.count ?? 1),
      createdAt: row.circle.createdAt.toISOString(),
      members: members.map((member) => ({
        circleId: member.circleId,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        name: member.name,
      })),
      invites,
    };
  },

  async createCircle(userId: string, input: CircleCreateInput): Promise<Circle> {
    const now = new Date();
    return db.transaction(async (tx) => {
      const [circle] = await tx
        .insert(circles)
        .values({
          ownerUserId: userId,
          name: input.name,
          description: input.description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await tx.insert(circleMemberships).values({
        circleId: circle!.id,
        userId,
        role: "owner",
        joinedAt: now,
      });
      return toCircle(circle!);
    });
  },

  async updateCircle(
    userId: string,
    circleId: string,
    input: CirclePatchInput
  ): Promise<Circle> {
    await requireManager(userId, circleId);
    const [updated] = await db
      .update(circles)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(circles.id, circleId))
      .returning();
    if (!updated) throw new NotFoundError("Circle not found.");
    return toCircle(updated);
  },

  async deleteCircle(userId: string, circleId: string): Promise<void> {
    const membership = await requireMembership(userId, circleId);
    if (!canDeleteCircle(membership.role)) {
      throw new ForbiddenError("Only the circle owner can delete a circle.");
    }
    const deleted = await db
      .delete(circles)
      .where(eq(circles.id, circleId))
      .returning({ id: circles.id });
    if (!deleted.length) throw new NotFoundError("Circle not found.");
  },

  async listMembers(userId: string, circleId: string): Promise<CircleMember[]> {
    await requireMembership(userId, circleId);
    const rows = await db
      .select({
        circleId: circleMemberships.circleId,
        userId: circleMemberships.userId,
        role: circleMemberships.role,
        joinedAt: circleMemberships.joinedAt,
        name: users.name,
      })
      .from(circleMemberships)
      .innerJoin(users, eq(circleMemberships.userId, users.id))
      .where(eq(circleMemberships.circleId, circleId))
      .orderBy(circleMemberships.joinedAt);
    return rows.map((row) => ({
      circleId: row.circleId,
      userId: row.userId,
      role: row.role,
      joinedAt: row.joinedAt.toISOString(),
      name: row.name,
    }));
  },

  async setMemberRole(
    userId: string,
    circleId: string,
    targetUserId: string,
    input: CircleRoleInput
  ): Promise<CircleMember> {
    const actor = await requireManager(userId, circleId);
    const [target] = await db
      .select({
        circleId: circleMemberships.circleId,
        userId: circleMemberships.userId,
        role: circleMemberships.role,
        joinedAt: circleMemberships.joinedAt,
        name: users.name,
      })
      .from(circleMemberships)
      .innerJoin(users, eq(circleMemberships.userId, users.id))
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, targetUserId)
        )
      )
      .limit(1);
    if (!target) throw new NotFoundError("Circle member not found.");
    if (!canSetCircleMemberRole(actor.role, target.role, targetUserId === userId)) {
      throw new ForbiddenError("You cannot change this member's role.");
    }

    const [updated] = await db
      .update(circleMemberships)
      .set({ role: input.role })
      .where(
        and(
          eq(circleMemberships.circleId, circleId),
          eq(circleMemberships.userId, targetUserId)
        )
      )
      .returning();
    return {
      circleId: updated!.circleId,
      userId: updated!.userId,
      role: updated!.role,
      joinedAt: updated!.joinedAt.toISOString(),
      name: target.name,
    };
  },

  async removeMember(userId: string, circleId: string, targetUserId: string): Promise<void> {
    const actor = await requireManager(userId, circleId);
    const target = await requireMembership(targetUserId, circleId);
    if (!canRemoveCircleMember(actor.role, target.role, targetUserId === userId)) {
      throw new ForbiddenError("You cannot remove this member.");
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .delete(circleMemberships)
        .where(
          and(
            eq(circleMemberships.circleId, circleId),
            eq(circleMemberships.userId, targetUserId)
          )
        );
      // Removing someone must stop their future sharing to this circle immediately.
      await tx
        .update(shareGrants)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(shareGrants.userId, targetUserId),
            eq(shareGrants.circleId, circleId),
            isNull(shareGrants.revokedAt)
          )
        );
    });
  },

  async leaveCircle(userId: string, circleId: string): Promise<void> {
    const membership = await requireMembership(userId, circleId);
    if (membership.role === "owner") {
      throw new ValidationError("The circle owner cannot leave. Delete the circle instead.");
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .delete(circleMemberships)
        .where(
          and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId))
        );
      await tx
        .update(shareGrants)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(shareGrants.userId, userId),
            eq(shareGrants.circleId, circleId),
            isNull(shareGrants.revokedAt)
          )
        );
      await tx
        .insert(safetyControls)
        .values({ userId, kind: "leave", circleId, createdAt: now })
        .onConflictDoNothing();
    });
  },

  async listInvites(userId: string, circleId: string): Promise<CircleInvite[]> {
    await requireManager(userId, circleId);
    const rows = await db
      .select({
        invite: circleInvites,
        circleName: circles.name,
        inviterName: users.name,
      })
      .from(circleInvites)
      .innerJoin(circles, eq(circleInvites.circleId, circles.id))
      .innerJoin(users, eq(circleInvites.inviterUserId, users.id))
      .where(eq(circleInvites.circleId, circleId))
      .orderBy(desc(circleInvites.createdAt));
    return rows.map((row) => toInvite(row.invite, row.circleName, row.inviterName));
  },

  async listReceivedInvites(userId: string, email: string): Promise<CircleInvite[]> {
    const rows = await db
      .select({
        invite: circleInvites,
        circleName: circles.name,
        inviterName: users.name,
      })
      .from(circleInvites)
      .innerJoin(circles, eq(circleInvites.circleId, circles.id))
      .innerJoin(users, eq(circleInvites.inviterUserId, users.id))
      .where(
        and(
          eq(circleInvites.inviteeEmail, normalizeEmail(email)),
          eq(circleInvites.status, "pending")
        )
      )
      .orderBy(desc(circleInvites.createdAt));
    return rows.map((row) => toInvite(row.invite, row.circleName, row.inviterName));
  },

  async createInvite(
    userId: string,
    circleId: string,
    input: CircleInviteInput
  ): Promise<CircleInvite> {
    await requireManager(userId, circleId);
    const inviteeEmail = normalizeEmail(input.email);
    const [actor] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!actor) throw new NotFoundError("Account not found.");
    if (normalizeEmail(actor.email) === inviteeEmail) {
      throw new ValidationError("You are already in this circle.");
    }

    const [invitee] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, inviteeEmail))
      .limit(1);
    if (invitee) {
      const [membership] = await db
        .select({ userId: circleMemberships.userId })
        .from(circleMemberships)
        .where(
          and(
            eq(circleMemberships.circleId, circleId),
            eq(circleMemberships.userId, invitee.id)
          )
        )
        .limit(1);
      if (membership) throw new ValidationError("This person is already in the circle.");
    }

    const [existing] = await db
      .select({ status: circleInvites.status })
      .from(circleInvites)
      .where(
        and(
          eq(circleInvites.circleId, circleId),
          eq(circleInvites.inviteeEmail, inviteeEmail),
          eq(circleInvites.status, "pending")
        )
      )
      .limit(1);
    if (existing) throw new ValidationError("A pending invite to this email already exists.");

    const now = new Date();
    const token = randomBytes(24).toString("base64url");
    const [row] = await db
      .insert(circleInvites)
      .values({
        circleId,
        inviterUserId: userId,
        inviteeEmail,
        inviteeUserId: null,
        token,
        status: "pending",
        expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toInvite(row!, await circleName(circleId), actor.name);
  },

  async getInviteForViewer(token: string, userId: string, email: string) {
    const [row] = await db
      .select({
        invite: circleInvites,
        circleName: circles.name,
        inviterName: users.name,
        description: circles.description,
      })
      .from(circleInvites)
      .innerJoin(circles, eq(circleInvites.circleId, circles.id))
      .innerJoin(users, eq(circleInvites.inviterUserId, users.id))
      .where(eq(circleInvites.token, token))
      .limit(1);
    if (!row) throw new NotFoundError("Circle invite not found.");

    const [counts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(circleMemberships)
      .where(eq(circleMemberships.circleId, row.invite.circleId));
    const [viewerMembership] = await db
      .select({ userId: circleMemberships.userId })
      .from(circleMemberships)
      .where(
        and(
          eq(circleMemberships.circleId, row.invite.circleId),
          eq(circleMemberships.userId, userId)
        )
      )
      .limit(1);

    return {
      invite: toInvite(row.invite, row.circleName, row.inviterName),
      circleDescription: row.description,
      memberCount: Number(counts?.count ?? 0),
      alreadyMember: Boolean(viewerMembership),
      canAccept: canAcceptCircleInvite(row.invite, { id: userId, email }),
    };
  },

  async respondToInvite(
    token: string,
    userId: string,
    email: string,
    accept: boolean
  ): Promise<CircleInvite> {
    const [row] = await db
      .select({ invite: circleInvites, circleName: circles.name, inviterName: users.name })
      .from(circleInvites)
      .innerJoin(circles, eq(circleInvites.circleId, circles.id))
      .innerJoin(users, eq(circleInvites.inviterUserId, users.id))
      .where(eq(circleInvites.token, token))
      .limit(1);
    if (!row) throw new NotFoundError("Circle invite not found.");

    if (accept) {
      if (!canAcceptCircleInvite(row.invite, { id: userId, email })) {
        throw new ValidationError("This invite cannot be accepted by this account.");
      }
    } else {
      if (row.invite.status !== "pending") {
        throw new ValidationError("This invite is no longer pending.");
      }
      if (normalizeEmail(row.invite.inviteeEmail) !== normalizeEmail(email)) {
        throw new ValidationError("This invite was sent to a different email address.");
      }
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(circleInvites)
        .set({
          status: accept ? "accepted" : "declined",
          inviteeUserId: userId,
          acceptedAt: accept ? now : null,
          updatedAt: now,
        })
        .where(eq(circleInvites.id, row.invite.id));
      if (accept) {
        await tx
          .insert(circleMemberships)
          .values({
            circleId: row.invite.circleId,
            userId,
            role: "member",
            joinedAt: now,
          })
          .onConflictDoNothing();
      }
    });

    const updated = await findInvite(row.invite.id);
    return toInvite(updated.invite, updated.circleName, updated.inviterName);
  },

  async cancelInvite(userId: string, inviteId: string): Promise<void> {
    const invite = await findInvite(inviteId);
    await requireManager(userId, invite.invite.circleId);
    const updated = await db
      .update(circleInvites)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(circleInvites.id, inviteId), eq(circleInvites.status, "pending"))
      )
      .returning({ id: circleInvites.id });
    if (!updated.length) throw new NotFoundError("Pending invite not found.");
  },

  async hasActiveMembership(userId: string, circleId: string): Promise<boolean> {
    const [membership] = await db
      .select({ userId: circleMemberships.userId })
      .from(circleMemberships)
      .where(
        and(eq(circleMemberships.circleId, circleId), eq(circleMemberships.userId, userId))
      )
      .limit(1);
    if (!membership) return false;

    const controls = await db
      .select()
      .from(safetyControls)
      .where(
        and(
          eq(safetyControls.userId, userId),
          eq(safetyControls.kind, "leave"),
          eq(safetyControls.circleId, circleId)
        )
      );
    return !controls.some((control) => isSafetyControlActive(control));
  },

  /** Only explicit, still-active grants from current members are visible here. */
  async listSharedUpdates(userId: string, circleId: string): Promise<CircleSharedUpdate[]> {
    if (!(await this.hasActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }

    const rows = await db
      .select()
      .from(shareGrants)
      .where(
        and(
          eq(shareGrants.audience, "circle"),
          eq(shareGrants.circleId, circleId),
          ne(shareGrants.userId, userId),
          isNull(shareGrants.revokedAt)
        )
      )
      .orderBy(desc(shareGrants.createdAt));

    const updates: CircleSharedUpdate[] = [];
    for (const row of rows) {
      const grant = toShareGrant(row);
      if (!isGrantActive(grant)) continue;
      if (!(await this.hasActiveMembership(grant.ownerId, circleId))) continue;

      const controls = await db
        .select()
        .from(safetyControls)
        .where(
          and(
            eq(safetyControls.userId, userId),
            inArray(safetyControls.kind, ["block", "mute"]),
            eq(safetyControls.targetUserId, grant.ownerId)
          )
        );
      if (controls.some((control) => isSafetyControlActive(control))) continue;

      const [owner] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, grant.ownerId))
        .limit(1);
      try {
        const preview = previewFromGrant(
          grant,
          await loadSharePreviewData(grant.ownerId, grant.habitId)
        );
        updates.push({
          ownerId: grant.ownerId,
          ownerName: owner?.name ?? "Circle member",
          preview,
        });
      } catch {
        // The habit may have been deleted between listing and projection.
        continue;
      }
    }
    return updates;
  },
};
