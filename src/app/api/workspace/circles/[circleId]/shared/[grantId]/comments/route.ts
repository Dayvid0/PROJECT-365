import { circleCommentSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ circleId: string; grantId: string }>;
}

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId, grantId } = await context.params;
    const input = await readJson(request, circleCommentSchema);
    return Response.json(
      {
        comment: await circleRepository.addCircleComment(user.id, circleId, grantId, input),
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
        { error: { code: "VALIDATION_ERROR", message: "A comment id is required." } },
        { status: 400 }
      );
    }
    await circleRepository.deleteCircleComment(user.id, circleId, id);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
