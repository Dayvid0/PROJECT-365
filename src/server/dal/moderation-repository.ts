import { desc, eq, inArray } from "drizzle-orm";
import {
  canTransitionPublicChallengeStatus,
  canTransitionSafetyReportStatus,
} from "@/domain/moderation";
import type {
  ModeratorPublicChallenge,
  ModeratorSafetyReport,
} from "@/domain/types";
import type {
  PublicChallengeDecisionInput,
  SafetyReportReviewInput,
} from "@/domain/validation";
import { isPublicDiscoveryEnabled } from "@/server/moderation-config";
import { db } from "@/server/db";
import {
  publicChallengeParticipants,
  publicChallenges,
  safetyReports,
  users,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

type PublicChallengeRow = typeof publicChallenges.$inferSelect;

async function participantCounts(challengeIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!challengeIds.length) return counts;
  const participants = await db
    .select({ challengeId: publicChallengeParticipants.challengeId })
    .from(publicChallengeParticipants)
    .where(inArray(publicChallengeParticipants.challengeId, challengeIds));
  for (const participant of participants) {
    counts.set(participant.challengeId, (counts.get(participant.challengeId) ?? 0) + 1);
  }
  return counts;
}

async function emailMap(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return emails;
  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, uniqueIds));
  for (const row of rows) emails.set(row.id, row.email);
  return emails;
}

function toModeratorChallenge(
  row: PublicChallengeRow,
  participantCount: number,
  proposerEmail: string | null,
  reviewedByEmail: string | null
): ModeratorPublicChallenge {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    participantCount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    proposerId: row.proposerUserId,
    proposerEmail,
    policyVersion: row.policyVersion,
    reviewNote: row.reviewNote,
    reviewedByEmail,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

async function loadModeratorChallenge(
  challengeId: string
): Promise<ModeratorPublicChallenge> {
  const [row] = await db
    .select()
    .from(publicChallenges)
    .where(eq(publicChallenges.id, challengeId))
    .limit(1);
  if (!row) throw new NotFoundError("Challenge not found.");
  const [counts, emails] = await Promise.all([
    participantCounts([row.id]),
    emailMap([row.proposerUserId, row.reviewedByUserId].filter(Boolean) as string[]),
  ]);
  return toModeratorChallenge(
    row,
    counts.get(row.id) ?? 0,
    row.proposerUserId ? emails.get(row.proposerUserId) ?? null : null,
    row.reviewedByUserId ? emails.get(row.reviewedByUserId) ?? null : null
  );
}

async function loadModeratorReport(reportId: string): Promise<ModeratorSafetyReport> {
  const [row] = await db
    .select()
    .from(safetyReports)
    .where(eq(safetyReports.id, reportId))
    .limit(1);
  if (!row) throw new NotFoundError("Report not found.");
  let reporterEmail: string | null = null;
  const reporter = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, row.reporterUserId))
    .limit(1);
  reporterEmail = reporter[0]?.email ?? null;

  const ids = [row.reviewedByUserId].filter(Boolean) as string[];
  const reviewers = await emailMap(ids);
  let targetSummary: string | null = null;
  if (row.targetType === "public_challenge") {
    const [challenge] = await db
      .select({ title: publicChallenges.title })
      .from(publicChallenges)
      .where(eq(publicChallenges.id, row.targetId))
      .limit(1);
    targetSummary = challenge?.title ?? null;
  }
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
    reporterEmail,
    reviewedByEmail: row.reviewedByUserId ? reviewers.get(row.reviewedByUserId) ?? null : null,
    targetSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const moderationRepository = {
  async listReports(): Promise<ModeratorSafetyReport[]> {
    const rows = await db
      .select()
      .from(safetyReports)
      .orderBy(desc(safetyReports.createdAt));
    const reports = await Promise.all(rows.map((row) => loadModeratorReport(row.id)));
    return reports;
  },

  async updateReportStatus(
    reportId: string,
    input: SafetyReportReviewInput,
    moderatorId: string
  ): Promise<ModeratorSafetyReport> {
    const [row] = await db
      .select()
      .from(safetyReports)
      .where(eq(safetyReports.id, reportId))
      .limit(1);
    if (!row) throw new NotFoundError("Report not found.");
    if (!canTransitionSafetyReportStatus(row.status, input.status)) {
      throw new ValidationError("That status change is not allowed.");
    }
    const now = new Date();
    await db
      .update(safetyReports)
      .set({
        status: input.status,
        reviewNote: input.note === undefined ? row.reviewNote : input.note,
        reviewedByUserId: moderatorId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(safetyReports.id, row.id));
    return loadModeratorReport(row.id);
  },

  async listChallengeQueue(): Promise<ModeratorPublicChallenge[]> {
    if (!isPublicDiscoveryEnabled()) return [];
    const rows = await db
      .select()
      .from(publicChallenges)
      .orderBy(desc(publicChallenges.createdAt));
    const [counts, emails] = await Promise.all([
      participantCounts(rows.map((row) => row.id)),
      emailMap(
        rows
          .flatMap((row) => [row.proposerUserId, row.reviewedByUserId])
          .filter(Boolean) as string[]
      ),
    ]);
    return rows.map((row) =>
      toModeratorChallenge(
        row,
        counts.get(row.id) ?? 0,
        row.proposerUserId ? emails.get(row.proposerUserId) ?? null : null,
        row.reviewedByUserId ? emails.get(row.reviewedByUserId) ?? null : null
      )
    );
  },

  async decidePublicChallenge(
    challengeId: string,
    input: PublicChallengeDecisionInput,
    moderatorId: string
  ): Promise<ModeratorPublicChallenge> {
    if (!isPublicDiscoveryEnabled()) {
      throw new ValidationError("Public challenge review is not configured.");
    }
    const [row] = await db
      .select()
      .from(publicChallenges)
      .where(eq(publicChallenges.id, challengeId))
      .limit(1);
    if (!row) throw new NotFoundError("Challenge not found.");
    if (!canTransitionPublicChallengeStatus(row.status, input.status)) {
      throw new ValidationError("That decision is not allowed for this challenge.");
    }
    if (input.status === "active" && row.endsAt <= new Date()) {
      throw new ValidationError("An ended challenge cannot be published.");
    }
    const now = new Date();
    await db
      .update(publicChallenges)
      .set({
        status: input.status,
        reviewNote: input.note ?? null,
        reviewedByUserId: moderatorId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(publicChallenges.id, row.id));
    return loadModeratorChallenge(row.id);
  },
};
