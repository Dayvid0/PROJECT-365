import { buildHabitCsv } from "@/domain/csv";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    const [habits, logs] = await Promise.all([
      workspaceRepository.listHabits(user.id),
      workspaceRepository.listAllLogs(user.id),
    ]);
    const csv = buildHabitCsv(habits, logs);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="project-365-habits.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
