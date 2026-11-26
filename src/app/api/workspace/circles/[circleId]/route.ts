import { circlePatchSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    return Response.json(await circleRepository.getCircleDetail(user.id, circleId));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    const patch = await readJson(request, circlePatchSchema);
    return Response.json({
      circle: await circleRepository.updateCircle(user.id, circleId, patch),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    await circleRepository.deleteCircle(user.id, circleId);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
