import { and, eq } from "drizzle-orm";
import { buildWeeklyReview, weekStartFor } from "@/domain/weekly-review";
import type { WeeklyReview } from "@/domain/types";
import { db } from "@/server/db";
import { weeklyReviews } from "@/server/db/schema";
import { workspaceRepository } from "./workspace-repository";

/**
 * The analytics window is user-scoped by getAnalyticsRange. Notes are keyed by
 * user + Monday date, so one account can never read another account's review.
 */
function monthsNeededFor(weekStart: string): number {
  const weekMonth = new Date(`${weekStart}T00:00:00Z`);
  const now = new Date();
  const weekIndex = weekMonth.getUTCFullYear() * 12 + weekMonth.getUTCMonth();
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  return Math.min(24, Math.max(2, nowIndex - weekIndex + 2));
}

export const weeklyReviewRepository = {
  async getReview(userId: string, week?: string): Promise<WeeklyReview> {
    const normalized = weekStartFor(week ?? new Date().toISOString().slice(0, 10));
    const [range, noteRow] = await Promise.all([
      workspaceRepository.getAnalyticsRange(userId, monthsNeededFor(normalized)),
      db
        .select({ note: weeklyReviews.note })
        .from(weeklyReviews)
        .where(
          and(eq(weeklyReviews.userId, userId), eq(weeklyReviews.weekStart, normalized))
        )
        .limit(1),
    ]);

    return buildWeeklyReview({
      weekStart: normalized,
      habits: range.habits,
      logs: range.logs,
      schedules: range.schedules,
      exceptions: range.exceptions,
      note: noteRow[0]?.note ?? null,
    });
  },

  async saveNote(userId: string, week: string, note: string): Promise<string> {
    const normalized = weekStartFor(week);
    const now = new Date();
    await db
      .insert(weeklyReviews)
      .values({
        userId,
        weekStart: normalized,
        note: note.trim() || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [weeklyReviews.userId, weeklyReviews.weekStart],
        set: { note: note.trim() || null, updatedAt: now },
      });
    return normalized;
  },
};
