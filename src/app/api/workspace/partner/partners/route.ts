import { requireSession } from "@/server/dal/auth-guard";
import { partnerInviteRepository } from "@/server/dal/partner-invite-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ partners: await partnerInviteRepository.listPartners(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
