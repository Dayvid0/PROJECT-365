import { requireModerator } from "@/server/dal/auth-guard";
import { moderationRepository } from "@/server/dal/moderation-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireModerator();
    return Response.json({ reports: await moderationRepository.listReports() });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
