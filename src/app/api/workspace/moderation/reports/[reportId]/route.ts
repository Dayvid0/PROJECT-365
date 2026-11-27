import { safetyReportReviewSchema } from "@/domain/validation";
import { requireModerator } from "@/server/dal/auth-guard";
import { moderationRepository } from "@/server/dal/moderation-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ reportId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireModerator();
    const { reportId } = await context.params;
    const input = await readJson(request, safetyReportReviewSchema);
    return Response.json({
      report: await moderationRepository.updateReportStatus(reportId, input, user.id),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
