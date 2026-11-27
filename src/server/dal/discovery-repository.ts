import { and, desc, eq, inArray } from "drizzle-orm";
import {
  canJoinPublicChallenge,
  isPublicChallengeVisible,
  PUBLIC_CHALLENGE_POLICY_VERSION,
} from "@/domain/moderation";
import type {
  PublicChallenge,
  PublicChallengeProposal,
} from "@/domain/types";
import type { PublicChallengeProposalInput } from "@/domain/validation";
import { isPublicDiscoveryEnabled } from "@/server/moderation-config";
import { db } from "@/server/db";
import {
  publicChallengeHides,
  publicChallengeParticipants,
  publicChallenges,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

type PublicChallengeRow = typeof publicChallenges.$inferSelect;

function toPublicChallenge(
  row: PublicChallengeRow,
  participantCount: number,
  viewerJoined: boolean
): PublicChallenge {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    participantCount,
    viewerJoined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProposal(
  row: PublicChallengeRow,
  participantCount: number,
  viewerJoined: boolean
): PublicChallengeProposal {
  return {
    ...toPublicChallenge(row, participantCount, viewerJoined),
    policyVersion: row.policyVersion,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    canWithdraw: row.status === "proposed",
  };
}

async function participationFor(
  challengeIds: string[],
  viewerId: string
): Promise<{ counts: Map<string, number>; joined: Set<string> }> {
  const counts = new Map<string, number>();
  const joined = new Set<string>();
  if (!challengeIds.length) return { counts, joined };
  const participants = await db
    .select({ challengeId: publicChallengeParticipants.challengeId, userId: publicChallengeParticipants.userId })
    .from(publicChallengeParticipants)
    .where(inArray(publicChallengeParticipants.challengeId, challengeIds));
  for (const participant of participants) {
    counts.set(participant.challengeId, (counts.get(participant.challengeId) ?? 0) + 1);
    if (participant.userId === viewerId) joined.add(participant.challengeId);
  }
  return { counts, joined };
}

async function requireVisibleChallenge(challengeId: string): Promise<PublicChallengeRow> {
  const [row] = await db
    .select()
    .from(publicChallenges)
    .where(eq(publicChallenges.id, challengeId))
    .limit(1);
  if (!row || !isPublicChallengeVisible(row.status)) {
    throw new NotFoundError("Challenge not found.");
  }
  return row;
}

export const discoveryRepository = {
  /** Signed-in discovery. No proposer, participant names, progress, or ranking. */
  async listPublicChallenges(viewerId: string): Promise<PublicChallenge[]> {
    if (!isPublicDiscoveryEnabled()) return [];
    const hidden = await db
      .select({ challengeId: publicChallengeHides.challengeId })
      .from(publicChallengeHides)
      .where(eq(publicChallengeHides.userId, viewerId));
    const hiddenIds = hidden.map((row) => row.challengeId);
    const rows = await db
      .select()
      .from(publicChallenges)
      .where(eq(publicChallenges.status, "active"))
      .orderBy(desc(publicChallenges.startsAt), desc(publicChallenges.createdAt));
    const visibleRows = rows.filter((row) => !hiddenIds.includes(row.id));
    const { counts, joined } = await participationFor(
      visibleRows.map((row) => row.id),
      viewerId
    );
    return visibleRows.map((row) =>
      toPublicChallenge(row, counts.get(row.id) ?? 0, joined.has(row.id))
    );
  },

  async listMyPublicChallenges(userId: string): Promise<PublicChallengeProposal[]> {
    const rows = await db
      .select()
      .from(publicChallenges)
      .where(eq(publicChallenges.proposerUserId, userId))
      .orderBy(desc(publicChallenges.createdAt));
    const { counts, joined } = await participationFor(
      rows.map((row) => row.id),
      userId
    );
    return rows.map((row) => toProposal(row, counts.get(row.id) ?? 0, joined.has(row.id)));
  },

  /** Proposals never auto-join the proposer and never reference a private habit. */
  async proposePublicChallenge(
    userId: string,
    input: PublicChallengeProposalInput
  ): Promise<PublicChallengeProposal> {
    if (!isPublicDiscoveryEnabled()) {
      throw new ValidationError("Public challenge review is not configured yet.");
    }
    const now = new Date();
    if (new Date(input.endsAt) <= now) {
      throw new ValidationError("Choose an end time in the future.");
    }
    const [row] = await db
      .insert(publicChallenges)
      .values({
        proposerUserId: userId,
        title: input.title,
        summary: input.summary,
        category: input.category,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        status: "proposed",
        policyVersion: PUBLIC_CHALLENGE_POLICY_VERSION,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toProposal(row!, 0, false);
  },

  async withdrawPublicChallenge(userId: string, challengeId: string): Promise<void> {
    const [row] = await db
      .select()
      .from(publicChallenges)
      .where(
        and(
          eq(publicChallenges.id, challengeId),
          eq(publicChallenges.proposerUserId, userId)
        )
      )
      .limit(1);
    if (!row) throw new NotFoundError("Proposal not found.");
    if (row.status !== "proposed") {
      throw new ValidationError("Only pending proposals can be withdrawn.");
    }
    await db.delete(publicChallenges).where(eq(publicChallenges.id, row.id));
  },

  async joinPublicChallenge(userId: string, challengeId: string): Promise<PublicChallenge> {
    if (!isPublicDiscoveryEnabled()) {
      throw new ValidationError("Public challenges are not available yet.");
    }
    const row = await requireVisibleChallenge(challengeId);
    if (!canJoinPublicChallenge({ status: row.status, endsAt: row.endsAt })) {
      throw new ValidationError("This challenge has already ended.");
    }
    await db.transaction(async (tx) => {
      await tx
        .insert(publicChallengeParticipants)
        .values({ challengeId: row.id, userId })
        .onConflictDoNothing();
      await tx
        .delete(publicChallengeHides)
        .where(
          and(
            eq(publicChallengeHides.challengeId, row.id),
            eq(publicChallengeHides.userId, userId)
          )
        );
    });
    const { counts, joined } = await participationFor([row.id], userId);
    return toPublicChallenge(row, counts.get(row.id) ?? 1, joined.has(row.id));
  },

  async leavePublicChallenge(userId: string, challengeId: string): Promise<void> {
    await db
      .delete(publicChallengeParticipants)
      .where(
        and(
          eq(publicChallengeParticipants.challengeId, challengeId),
          eq(publicChallengeParticipants.userId, userId)
        )
      );
  },

  async hidePublicChallenge(userId: string, challengeId: string): Promise<void> {
    await requireVisibleChallenge(challengeId);
    await db
      .insert(publicChallengeHides)
      .values({ challengeId, userId })
      .onConflictDoNothing();
  },

  async unhidePublicChallenge(userId: string, challengeId: string): Promise<void> {
    await db
      .delete(publicChallengeHides)
      .where(
        and(
          eq(publicChallengeHides.challengeId, challengeId),
          eq(publicChallengeHides.userId, userId)
        )
      );
  },
};
