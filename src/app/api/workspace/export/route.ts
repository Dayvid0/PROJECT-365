import { buildHabitCsv } from "@/domain/csv";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireSession();
    const format = new URL(request.url).searchParams.get("format") ?? "csv";

    if (format === "json") {
      const backup = await workspaceRepository.getWorkspaceBackup(user.id);
      const stamp = backup.exportedAt.slice(0, 10);
      return new Response(JSON.stringify(backup, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="daymark-backup-${stamp}.json"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [habits, logs] = await Promise.all([
      workspaceRepository.listHabits(user.id),
      workspaceRepository.listAllLogs(user.id),
    ]);
    const csv = buildHabitCsv(habits, logs);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="daymark-habits.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
