import {
  weeklyNoteSchema,
  weeklyReviewQuerySchema,
} from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { routeErrorResponse, readJson } from "@/server/http/responses";
import { weeklyReviewRepository } from "@/server/dal/weekly-review-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireSession();
    const { week } = weeklyReviewQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    return Response.json({ review: await weeklyReviewRepository.getReview(user.id, week) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, weeklyNoteSchema);
    const weekStart = await weeklyReviewRepository.saveNote(
      user.id,
      input.week,
      input.note
    );
    return Response.json({ weekStart, note: input.note || null });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
