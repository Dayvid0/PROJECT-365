import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import {
  canAcceptCircleInvite,
  canDeleteCircle,
  canDeleteCircleContent,
  canJoinCircleChallenge,
  canManageCircle,
  canRemoveCircleMember,
  canSetCircleMemberRole,
  hasActiveSafetyBoundary,
} from "@/domain/circles";
import { isGrantActive, isSafetyControlActive } from "@/domain/sharing";
import type {
  Circle,
  CircleChallenge,
  CircleComment,
  CircleInvite,
  CircleMember,
  CircleReactionKind,
  CircleReactionSummary,
  CircleReceivedSupport,
  CircleSharedUpdate,
  CircleSummary,
  CircleUpdateInteraction,
  SafetyControl,
} from "@/domain/types";
import type {
  CircleChallengeInput,
  CircleChallengeParticipationInput,
  CircleCommentInput,
  CircleCreateInput,
  CircleInviteInput,
  CirclePatchInput,
  CircleReactionInput,
  CircleRoleInput,
} from "@/domain/validation";
import { db } from "@/server/db";
import {
  circleChallengeParticipants,
  circleChallenges,
  circleComments,
  circleInvites,
  circleMemberships,
  circleReactions,
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
type ShareGrantRow = typeof shareGrants.$inferSelect;
type SafetyControlRow = typeof safetyControls.$inferSelect;
type ChallengeRow = typeof circleChallenges.$inferSelect;
type ReactionRow = typeof circleReactions.$inferSelect;

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function toBoundaryControl(control: SafetyControlRow): SafetyControl {
  return {
    id: control.id,
    userId: control.userId,
    kind: control.kind,
    targetUserId: control.targetUserId,
    circleId: control.circleId,
    createdAt: control.createdAt.toISOString(),
    expiresAt: control.expiresAt?.toISOString() ?? null,
  };
}

function emptyInteraction(grantId: string): CircleUpdateInteraction {
  return {
    grantId,
    reactions: { grantId, counts: { cheer: 0, support: 0, respect: 0 }, viewerReaction: null },
    comments: [],
  };
}

function toReactionSummary(
  grantId: string,
  rows: ReactionRow[],
  viewerId: string
): CircleReactionSummary {
  const counts: Record<CircleReactionKind, number> = { cheer: 0, support: 0, respect: 0 };
  let viewerReaction: CircleReactionKind | null = null;
  for (const row of rows) {
    counts[row.kind] += 1;
    if (row.userId === viewerId) viewerReaction = row.kind;
  }
  return { grantId, counts, viewerReaction };
}

function toCircleChallenge(
  row: ChallengeRow,
  creatorName: string,
  participantCount: number,
  viewerJoined: boolean,
  role: MembershipRow["role"] | null,
  viewerId: string
): CircleChallenge {
  return {
    id: row.id,
    circleId: row.circleId,
    creatorId: row.creatorUserId,
    creatorName,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    participantCount,
    viewerJoined,
    canDelete: canDeleteCircleContent(role, row.creatorUserId === viewerId),
    createdAt: row.createdAt.toISOString(),
  };
}

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

async function isActiveMembership(userId: string, circleId: string): Promise<boolean> {
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
}

async function activeMemberIds(circleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ userId: circleMemberships.userId })
    .from(circleMemberships)
    .where(eq(circleMemberships.circleId, circleId));
  return new Set(rows.map((row) => row.userId));
}

async function boundaryControlsForViewer(viewerId: string): Promise<SafetyControl[]> {
  const rows = await db
    .select()
    .from(safetyControls)
    .where(
      and(
        inArray(safetyControls.kind, ["block", "mute"]),
        or(
          eq(safetyControls.userId, viewerId),
          eq(safetyControls.targetUserId, viewerId)
        )
      )
    );
  return rows.map(toBoundaryControl);
}

/** Both the viewer and the content author must still have a grant-backed view. */
async function requireVisibleGrant(
  viewerId: string,
  circleId: string,
  grantId: string
): Promise<{ row: ShareGrantRow; role: MembershipRow["role"] }> {
  const membership = await requireMembership(viewerId, circleId);
  if (!(await isActiveMembership(viewerId, circleId))) {
    throw new NotFoundError("Circle not found.");
  }
  const [row] = await db
    .select()
    .from(shareGrants)
    .where(
      and(
        eq(shareGrants.id, grantId),
        eq(shareGrants.audience, "circle"),
        eq(shareGrants.circleId, circleId),
        ne(shareGrants.userId, viewerId),
        isNull(shareGrants.revokedAt)
      )
    )
    .limit(1);
  if (!row) throw new NotFoundError("Shared update not found.");
  if (!isGrantActive(toShareGrant(row))) {
    throw new NotFoundError("Shared update not found.");
  }
  if (!(await isActiveMembership(row.userId, circleId))) {
    throw new NotFoundError("Shared update not found.");
  }
  const controls = await boundaryControlsForViewer(viewerId);
  if (hasActiveSafetyBoundary(viewerId, row.userId, controls)) {
    throw new NotFoundError("Shared update not found.");
  }
  return { row, role: membership.role };
}

async function loadUpdateInteractions(
  viewerId: string,
  circleId: string,
  role: MembershipRow["role"],
  grants: ShareGrantRow[]
): Promise<Map<string, CircleUpdateInteraction>> {
  const result = new Map<string, CircleUpdateInteraction>();
  for (const grant of grants) result.set(grant.id, emptyInteraction(grant.id));
  if (!grants.length) return result;

  const grantIds = grants.map((grant) => grant.id);
  const [members, controls, reactionRows, commentRows] = await Promise.all([
    activeMemberIds(circleId),
    boundaryControlsForViewer(viewerId),
    db
      .select()
      .from(circleReactions)
      .where(
        and(eq(circleReactions.circleId, circleId), inArray(circleReactions.grantId, grantIds))
      ),
    db
      .select({ comment: circleComments, authorName: users.name })
      .from(circleComments)
      .innerJoin(users, eq(circleComments.authorUserId, users.id))
      .where(
        and(eq(circleComments.circleId, circleId), inArray(circleComments.grantId, grantIds))
      )
      .orderBy(desc(circleComments.createdAt)),
  ]);

  const hasBoundary = (otherId: string) =>
    hasActiveSafetyBoundary(viewerId, otherId, controls);

  for (const [grantId, interaction] of result) {
    const rows = reactionRows.filter(
      (row) => row.grantId === grantId && members.has(row.userId) && !hasBoundary(row.userId)
    );
    interaction.reactions = toReactionSummary(grantId, rows, viewerId);
  }

  for (const row of commentRows) {
    if (!members.has(row.comment.authorUserId) || hasBoundary(row.comment.authorUserId)) {
      continue;
    }
    const interaction = result.get(row.comment.grantId);
    if (!interaction) continue;
    interaction.comments.push({
      id: row.comment.id,
      circleId: row.comment.circleId,
      grantId: row.comment.grantId,
      authorId: row.comment.authorUserId,
      authorName: row.authorName,
      body: row.comment.body,
      createdAt: row.comment.createdAt.toISOString(),
      canDelete: canDeleteCircleContent(role, row.comment.authorUserId === viewerId),
    });
  }
  return result;
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
      await tx
        .delete(circleReactions)
        .where(
          and(
            eq(circleReactions.circleId, circleId),
            eq(circleReactions.userId, targetUserId)
          )
        );
      await tx
        .delete(circleComments)
        .where(
          and(
            eq(circleComments.circleId, circleId),
            eq(circleComments.authorUserId, targetUserId)
          )
        );
      const challengeIds = (
        await tx
          .select({ id: circleChallenges.id })
          .from(circleChallenges)
          .where(eq(circleChallenges.circleId, circleId))
      ).map((row) => row.id);
      if (challengeIds.length) {
        await tx
          .delete(circleChallengeParticipants)
          .where(
            and(
              eq(circleChallengeParticipants.userId, targetUserId),
              inArray(circleChallengeParticipants.challengeId, challengeIds)
            )
          );
      }
      await tx
        .delete(circleChallenges)
        .where(
          and(
            eq(circleChallenges.circleId, circleId),
            eq(circleChallenges.creatorUserId, targetUserId)
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
        .delete(circleReactions)
        .where(and(eq(circleReactions.circleId, circleId), eq(circleReactions.userId, userId)));
      await tx
        .delete(circleComments)
        .where(
          and(eq(circleComments.circleId, circleId), eq(circleComments.authorUserId, userId))
        );
      const challengeIds = (
        await tx
          .select({ id: circleChallenges.id })
          .from(circleChallenges)
          .where(eq(circleChallenges.circleId, circleId))
      ).map((row) => row.id);
      if (challengeIds.length) {
        await tx
          .delete(circleChallengeParticipants)
          .where(
            and(
              eq(circleChallengeParticipants.userId, userId),
              inArray(circleChallengeParticipants.challengeId, challengeIds)
            )
          );
      }
      await tx
        .delete(circleChallenges)
        .where(
          and(eq(circleChallenges.circleId, circleId), eq(circleChallenges.creatorUserId, userId))
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
    return isActiveMembership(userId, circleId);
  },

  /** Only explicit, still-active grants from current members are visible here. */
  async listSharedUpdates(userId: string, circleId: string): Promise<CircleSharedUpdate[]> {
    const membership = await requireMembership(userId, circleId);
    if (!(await isActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }

    const controls = await boundaryControlsForViewer(userId);
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
    const visibleGrants: ShareGrantRow[] = [];
    for (const row of rows) {
      const grant = toShareGrant(row);
      if (!isGrantActive(grant)) continue;
      if (!(await isActiveMembership(grant.ownerId, circleId))) continue;
      if (hasActiveSafetyBoundary(userId, grant.ownerId, controls)) continue;

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
          interactions: emptyInteraction(grant.id),
        });
        visibleGrants.push(row);
      } catch {
        // The habit may have been deleted between listing and projection.
        continue;
      }
    }

    const interactions = await loadUpdateInteractions(
      userId,
      circleId,
      membership.role,
      visibleGrants
    );
    for (const update of updates) {
      update.interactions =
        interactions.get(update.preview.grantId) ?? emptyInteraction(update.preview.grantId);
    }
    return updates;
  },

  /** Read-only support on the viewer's own grants, filtered by the same boundaries. */
  async listReceivedSupport(
    userId: string,
    circleId: string
  ): Promise<CircleReceivedSupport[]> {
    const membership = await requireMembership(userId, circleId);
    if (!(await isActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }

    const rows = await db
      .select()
      .from(shareGrants)
      .where(
        and(
          eq(shareGrants.userId, userId),
          eq(shareGrants.audience, "circle"),
          eq(shareGrants.circleId, circleId),
          isNull(shareGrants.revokedAt)
        )
      )
      .orderBy(desc(shareGrants.createdAt));
    const grants = rows.filter((row) => isGrantActive(toShareGrant(row)));
    if (!grants.length) return [];

    const interactions = await loadUpdateInteractions(
      userId,
      circleId,
      membership.role,
      grants
    );
    const result: CircleReceivedSupport[] = [];
    for (const row of grants) {
      const grant = toShareGrant(row);
      let label = "Your shared update";
      try {
        const preview = previewFromGrant(
          grant,
          await loadSharePreviewData(userId, grant.habitId)
        );
        label =
          preview.fields.find(
            (field) => field.field === "alias" || field.field === "name"
          )?.value ?? label;
      } catch {
        // The habit may have been deleted; the label fallback is still safe.
      }
      const interaction = interactions.get(grant.id);
      if (interaction) {
        result.push({ grantId: grant.id, label, interactions: interaction });
      }
    }
    return result;
  },

  /** A second tap removes the same reaction; changing kind replaces it. */
  async setCircleReaction(
    userId: string,
    circleId: string,
    grantId: string,
    input: CircleReactionInput
  ): Promise<CircleReactionSummary> {
    const visible = await requireVisibleGrant(userId, circleId, grantId);
    const [existing] = await db
      .select()
      .from(circleReactions)
      .where(
        and(
          eq(circleReactions.circleId, circleId),
          eq(circleReactions.grantId, grantId),
          eq(circleReactions.userId, userId)
        )
      )
      .limit(1);

    if (existing?.kind === input.kind) {
      await db.delete(circleReactions).where(eq(circleReactions.id, existing.id));
    } else if (existing) {
      await db
        .update(circleReactions)
        .set({ kind: input.kind, updatedAt: new Date() })
        .where(eq(circleReactions.id, existing.id));
    } else {
      await db
        .insert(circleReactions)
        .values({ circleId, grantId, userId, kind: input.kind })
        .onConflictDoNothing();
    }

    const interactions = await loadUpdateInteractions(userId, circleId, visible.role, [visible.row]);
    return interactions.get(grantId)?.reactions ?? emptyInteraction(grantId).reactions;
  },

  async addCircleComment(
    userId: string,
    circleId: string,
    grantId: string,
    input: CircleCommentInput
  ): Promise<CircleComment> {
    const visible = await requireVisibleGrant(userId, circleId, grantId);
    const now = new Date();
    const [row] = await db
      .insert(circleComments)
      .values({
        circleId,
        grantId,
        authorUserId: userId,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const [author] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return {
      id: row!.id,
      circleId: row!.circleId,
      grantId: row!.grantId,
      authorId: row!.authorUserId,
      authorName: author?.name ?? "You",
      body: row!.body,
      createdAt: row!.createdAt.toISOString(),
      canDelete: canDeleteCircleContent(visible.role, true),
    };
  },

  async deleteCircleComment(
    userId: string,
    circleId: string,
    commentId: string
  ): Promise<void> {
    const [row] = await db
      .select()
      .from(circleComments)
      .where(and(eq(circleComments.id, commentId), eq(circleComments.circleId, circleId)))
      .limit(1);
    if (!row) throw new NotFoundError("Comment not found.");
    const visible = await requireVisibleGrant(userId, circleId, row.grantId);
    if (!canDeleteCircleContent(visible.role, row.authorUserId === userId)) {
      throw new ForbiddenError("You cannot delete this comment.");
    }
    await db.delete(circleComments).where(eq(circleComments.id, row.id));
  },

  async listCircleChallenges(userId: string, circleId: string): Promise<CircleChallenge[]> {
    const membership = await requireMembership(userId, circleId);
    if (!(await isActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }
    const rows = await db
      .select({ challenge: circleChallenges, creatorName: users.name })
      .from(circleChallenges)
      .innerJoin(users, eq(circleChallenges.creatorUserId, users.id))
      .where(eq(circleChallenges.circleId, circleId))
      .orderBy(desc(circleChallenges.startsAt), desc(circleChallenges.createdAt));
    if (!rows.length) return [];

    const [members, controls, participants] = await Promise.all([
      activeMemberIds(circleId),
      boundaryControlsForViewer(userId),
      db
        .select({ challengeId: circleChallengeParticipants.challengeId, userId: circleChallengeParticipants.userId })
        .from(circleChallengeParticipants)
        .where(
          inArray(
            circleChallengeParticipants.challengeId,
            rows.map((row) => row.challenge.id)
          )
        ),
    ]);
    const counts = new Map<string, number>();
    const joined = new Set<string>();
    for (const participant of participants) {
      if (!members.has(participant.userId)) continue;
      if (hasActiveSafetyBoundary(userId, participant.userId, controls)) continue;
      counts.set(participant.challengeId, (counts.get(participant.challengeId) ?? 0) + 1);
      if (participant.userId === userId) joined.add(participant.challengeId);
    }

    return rows
      .filter(
        (row) =>
          members.has(row.challenge.creatorUserId) &&
          !hasActiveSafetyBoundary(userId, row.challenge.creatorUserId, controls)
      )
      .map((row) =>
        toCircleChallenge(
          row.challenge,
          row.creatorName,
          counts.get(row.challenge.id) ?? 0,
          joined.has(row.challenge.id),
          membership.role,
          userId
        )
      );
  },

  async createCircleChallenge(
    userId: string,
    circleId: string,
    input: CircleChallengeInput
  ): Promise<CircleChallenge> {
    const membership = await requireMembership(userId, circleId);
    if (!(await isActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }
    if (new Date(input.endsAt) <= new Date()) {
      throw new ValidationError("Choose an end time in the future.");
    }
    const [creator] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const now = new Date();
    const row = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(circleChallenges)
        .values({
          circleId,
          creatorUserId: userId,
          title: input.title,
          description: input.description ?? null,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await tx
        .insert(circleChallengeParticipants)
        .values({ challengeId: created!.id, userId })
        .onConflictDoNothing();
      return created!;
    });
    return toCircleChallenge(row, creator?.name ?? "You", 1, true, membership.role, userId);
  },

  async setCircleChallengeParticipation(
    userId: string,
    circleId: string,
    challengeId: string,
    input: CircleChallengeParticipationInput
  ): Promise<CircleChallenge> {
    const membership = await requireMembership(userId, circleId);
    if (!(await isActiveMembership(userId, circleId))) {
      throw new NotFoundError("Circle not found.");
    }
    const [row] = await db
      .select({ challenge: circleChallenges, creatorName: users.name })
      .from(circleChallenges)
      .innerJoin(users, eq(circleChallenges.creatorUserId, users.id))
      .where(
        and(eq(circleChallenges.id, challengeId), eq(circleChallenges.circleId, circleId))
      )
      .limit(1);
    if (!row) throw new NotFoundError("Challenge not found.");
    if (!canJoinCircleChallenge(row.challenge)) {
      throw new ValidationError("This challenge has already ended.");
    }
    const controls = await boundaryControlsForViewer(userId);
    if (hasActiveSafetyBoundary(userId, row.challenge.creatorUserId, controls)) {
      throw new NotFoundError("Challenge not found.");
    }

    if (input.joined) {
      await db
        .insert(circleChallengeParticipants)
        .values({ challengeId, userId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(circleChallengeParticipants)
        .where(
          and(
            eq(circleChallengeParticipants.challengeId, challengeId),
            eq(circleChallengeParticipants.userId, userId)
          )
        );
    }

    const [members, participants, joined] = await Promise.all([
      activeMemberIds(circleId),
      db
        .select({ userId: circleChallengeParticipants.userId })
        .from(circleChallengeParticipants)
        .where(eq(circleChallengeParticipants.challengeId, challengeId)),
      db
        .select({ userId: circleChallengeParticipants.userId })
        .from(circleChallengeParticipants)
        .where(
          and(
            eq(circleChallengeParticipants.challengeId, challengeId),
            eq(circleChallengeParticipants.userId, userId)
          )
        )
        .limit(1),
    ]);
    return toCircleChallenge(
      row.challenge,
      row.creatorName,
      participants.filter(
        (participant) =>
          members.has(participant.userId) &&
          !hasActiveSafetyBoundary(userId, participant.userId, controls)
      ).length,
      joined.length > 0,
      membership.role,
      userId
    );
  },

  async deleteCircleChallenge(
    userId: string,
    circleId: string,
    challengeId: string
  ): Promise<void> {
    const [row] = await db
      .select()
      .from(circleChallenges)
      .where(and(eq(circleChallenges.id, challengeId), eq(circleChallenges.circleId, circleId)))
      .limit(1);
    if (!row) throw new NotFoundError("Challenge not found.");
    const membership = await requireMembership(userId, circleId);
    if (!canDeleteCircleContent(membership.role, row.creatorUserId === userId)) {
      throw new ForbiddenError("You cannot delete this challenge.");
    }
    await db.delete(circleChallenges).where(eq(circleChallenges.id, row.id));
  },
};
