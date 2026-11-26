import { partnerInviteSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { partnerInviteRepository } from "@/server/dal/partner-invite-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json(
      await partnerInviteRepository.listInvites(user.id, user.email)
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, partnerInviteSchema);
    return Response.json(
      { invite: await partnerInviteRepository.createInvite(user.id, input) },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireSession();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "An invite id is required." } },
        { status: 400 }
      );
    }
    await partnerInviteRepository.cancelInvite(user.id, id);
    return Response.json({ cancelled: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
