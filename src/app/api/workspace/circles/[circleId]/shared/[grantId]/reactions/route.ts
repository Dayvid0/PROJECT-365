import { circleReactionSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string; grantId: string }>;
}

/** Reactions are anonymous counts and only attach to a currently visible grant. */
export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId, grantId } = await context.params;
    const input = await readJson(request, circleReactionSchema);
    return Response.json({
      reaction: await circleRepository.setCircleReaction(user.id, circleId, grantId, input),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
