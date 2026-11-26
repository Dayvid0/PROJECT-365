import { circleChallengeParticipationSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string; challengeId: string }>;
}

/** Joining records participation only; it never exposes habit data or a ranking. */
export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId, challengeId } = await context.params;
    const input = await readJson(request, circleChallengeParticipationSchema);
    return Response.json({
      challenge: await circleRepository.setCircleChallengeParticipation(
        user.id,
        circleId,
        challengeId,
        input
      ),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
