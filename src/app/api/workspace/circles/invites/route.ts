import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** Only invites addressed to the signed-in user's exact email are returned. */
export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({
      invites: await circleRepository.listReceivedInvites(user.id, user.email),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
