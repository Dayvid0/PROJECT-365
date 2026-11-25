import { z } from "zod";
import { scheduleExceptionSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ exceptions: await workspaceRepository.listExceptions(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireSession();
    const body = await readJson(
      request,
      z.object({
        habitId: z.string().min(1),
        exception: scheduleExceptionSchema,
      })
    );
    const exception = await workspaceRepository.createException(
      user.id,
      body.habitId,
      body.exception
    );
    return Response.json({ exception }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireSession();
    const { id } = z
      .object({ id: z.string().min(1) })
      .parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    await workspaceRepository.deleteException(user.id, id);
    return Response.json({ deleted: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
