import { circleCreateSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { circleRepository } from "@/server/dal/circle-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ circles: await circleRepository.listCircles(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, circleCreateSchema);
    return Response.json(
      { circle: await circleRepository.createCircle(user.id, input) },
      { status: 201 }
    );
  } catch (error) {
    return routeErrorResponse(error);
  }
}
