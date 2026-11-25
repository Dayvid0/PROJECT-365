import { workspaceBackupSchema } from "@/domain/backup";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** Full restore from a PROJECT_365 JSON backup. Replaces the current workspace. */
export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const backup = await readJson(request, workspaceBackupSchema);
    await workspaceRepository.restoreWorkspace(user.id, backup);
    return Response.json({ restored: true, habits: backup.habits.length, logs: backup.logs.length });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
