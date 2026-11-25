import { createHabitSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ habits: await workspaceRepository.listHabits(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const input = await readJson(request, createHabitSchema);
    const position = await workspaceRepository.nextHabitPosition(user.id);
    const habit = await workspaceRepository.createHabit(user.id, {
      ...input,
      order: position,
    });
    return Response.json({ habit }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
