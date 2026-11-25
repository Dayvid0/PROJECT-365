import { z } from "zod";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireSession();
    const { months } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    return Response.json(await workspaceRepository.getAnalyticsRange(user.id, months));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
