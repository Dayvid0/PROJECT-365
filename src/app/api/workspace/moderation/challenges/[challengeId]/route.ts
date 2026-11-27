import { publicChallengeDecisionSchema } from "@/domain/validation";
import { requireModerator } from "@/server/dal/auth-guard";
import { moderationRepository } from "@/server/dal/moderation-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ challengeId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireModerator();
    const { challengeId } = await context.params;
    const input = await readJson(request, publicChallengeDecisionSchema);
    return Response.json({
      challenge: await moderationRepository.decidePublicChallenge(
        challengeId,
        input,
        user.id
      ),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
