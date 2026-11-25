import { deleteLogSchema, monthSchema, upsertLogsSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireSession();
    const month = monthSchema.parse(new URL(request.url).searchParams.get("month"));
    return Response.json({ logs: await workspaceRepository.listLogs(user.id, month) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireSession();
    const logs = await readJson(request, upsertLogsSchema);
    await workspaceRepository.upsertLogs(user.id, logs);
    return Response.json({ saved: logs.length });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireSession();
    const input = deleteLogSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    await workspaceRepository.deleteLog(user.id, input);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
