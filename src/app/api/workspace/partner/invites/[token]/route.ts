import { requireSession } from "@/server/dal/auth-guard";
import { partnerInviteRepository } from "@/server/dal/partner-invite-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { token } = await context.params;
    return Response.json(
      await partnerInviteRepository.getInviteForViewer(token, user.id, user.email)
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
