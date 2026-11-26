import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string }>;
}

/**
 * Circle visibility is grant-driven only: no automatic feed, reactions,
 * comments, or challenges are part of this endpoint.
 */
export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    return Response.json({
      updates: await circleRepository.listSharedUpdates(user.id, circleId),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
