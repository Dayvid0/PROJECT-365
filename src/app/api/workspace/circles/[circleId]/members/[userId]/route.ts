import { circleRoleSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string; userId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId, userId } = await context.params;
    const input = await readJson(request, circleRoleSchema);
    return Response.json({
      member: await circleRepository.setMemberRole(user.id, circleId, userId, input),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId, userId } = await context.params;
    await circleRepository.removeMember(user.id, circleId, userId);
    return Response.json({ removed: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
