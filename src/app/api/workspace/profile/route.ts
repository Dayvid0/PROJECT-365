import { profilePatchSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const { user } = await requireSession();
    const patch = await readJson(request, profilePatchSchema);
    return Response.json({ user: await workspaceRepository.updateProfile(user.id, patch) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
