import { circleChallengeSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string }>;
}

/** Circle-local intentions only: no public discovery, progress feed, or ranking. */
export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    return Response.json({
      challenges: await circleRepository.listCircleChallenges(user.id, circleId),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    const input = await readJson(request, circleChallengeSchema);
    return Response.json(
      {
        challenge: await circleRepository.createCircleChallenge(user.id, circleId, input),
      },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "A challenge id is required." } },
        { status: 400 }
      );
    }
    await circleRepository.deleteCircleChallenge(user.id, circleId, id);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
