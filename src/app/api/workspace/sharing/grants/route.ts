import { shareGrantSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { socialRepository } from "@/server/dal/social-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ grants: await socialRepository.listShareGrants(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, shareGrantSchema);
    return Response.json(
      { grant: await socialRepository.createShareGrant(user.id, input) },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
