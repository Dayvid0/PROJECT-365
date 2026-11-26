import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ token: string }>;
}

/** Preview before consent: circle identity and what joining does, not member details. */
export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { token } = await context.params;
    return Response.json(
      await circleRepository.getInviteForViewer(token, user.id, user.email)
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
