import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    await circleRepository.leaveCircle(user.id, circleId);
    return Response.json({ left: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
