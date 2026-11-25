import { onboardingModeSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const { mode } = await readJson(request, onboardingModeSchema);
    const habits = await workspaceRepository.completeOnboarding(user.id, mode);
    return Response.json({ habits });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
