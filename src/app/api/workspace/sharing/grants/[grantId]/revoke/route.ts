import { requireSession } from "@/server/dal/auth-guard";
import { socialRepository } from "@/server/dal/social-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ grantId: string }>;
}

export async function POST(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { grantId } = await context.params;
    return Response.json({ grant: await socialRepository.revokeShareGrant(user.id, grantId) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
