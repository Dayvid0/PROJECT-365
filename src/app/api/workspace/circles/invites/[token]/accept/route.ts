import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ token: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { token } = await context.params;
    return Response.json({
      invite: await circleRepository.respondToInvite(token, user.id, user.email, true),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
