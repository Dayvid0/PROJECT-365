import { safetyControlSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { socialRepository } from "@/server/dal/social-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ controls: await socialRepository.listSafetyControls(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, safetyControlSchema);
    return Response.json(
      { control: await socialRepository.setSafetyControl(user.id, input) },
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
        { error: { code: "VALIDATION_ERROR", message: "A control id is required." } },
        { status: 400 }
      );
    }
    await socialRepository.removeSafetyControl(user.id, id);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
