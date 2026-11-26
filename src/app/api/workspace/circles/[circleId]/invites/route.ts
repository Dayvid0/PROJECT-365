import { circleInviteSchema } from "@/domain/validation";
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
    return Response.json({ invites: await circleRepository.listInvites(user.id, circleId) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { circleId } = await context.params;
    const input = await readJson(request, circleInviteSchema);
    return Response.json(
      { invite: await circleRepository.createInvite(user.id, circleId, input) },
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
        { error: { code: "VALIDATION_ERROR", message: "An invite id is required." } },
        { status: 400 }
      );
    }
    const invite = (await circleRepository.listInvites(user.id, circleId)).find(
      (item) => item.id === id
    );
    if (!invite) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Invite not found." } },
        { status: 404 }
      );
    }
    await circleRepository.cancelInvite(user.id, id);
    return Response.json({ cancelled: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
