import { updateHabitSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ habitId: string }>;
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { habitId } = await context.params;
    const input = await readJson(request, updateHabitSchema);
    const habit = await workspaceRepository.updateHabit(user.id, habitId, input);
    return Response.json({ habit });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
