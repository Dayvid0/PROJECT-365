import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    return Response.json({ members: await circleRepository.listMembers(user.id, circleId) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
