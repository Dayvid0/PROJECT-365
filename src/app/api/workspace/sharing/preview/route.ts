import { shareGrantSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { socialRepository } from "@/server/dal/social-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, shareGrantSchema);
    return Response.json({
      preview: await socialRepository.previewShareGrant(user.id, input),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
