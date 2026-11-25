import { monthSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ month: string }>;
}

export async function GET(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { month } = await context.params;
    const parsedMonth = monthSchema.parse(month);
    return Response.json({
      snapshot: await workspaceRepository.getSnapshot(user.id, parsedMonth),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { user } = await requireSession();
    const { month } = await context.params;
    await workspaceRepository.deleteSnapshot(user.id, monthSchema.parse(month));
    return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
