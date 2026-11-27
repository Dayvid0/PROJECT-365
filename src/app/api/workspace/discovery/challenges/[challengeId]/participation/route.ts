import { requireSession } from "@/server/dal/auth-guard";
import { discoveryRepository } from "@/server/dal/discovery-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ challengeId: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { challengeId } = await context.params;
    return Response.json({
      challenge: await discoveryRepository.joinPublicChallenge(user.id, challengeId),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { challengeId } = await context.params;
    await discoveryRepository.leavePublicChallenge(user.id, challengeId);
    return Response.json({ left: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
