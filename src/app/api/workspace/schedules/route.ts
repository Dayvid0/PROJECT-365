import { z } from "zod";
import { createScheduleVersionSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  habitId: z.string().min(1).optional(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireSession();
    const { habitId } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const schedules = await workspaceRepository.listSchedules(user.id);
    return Response.json({
      schedules: habitId ? schedules.filter((item) => item.habitId === habitId) : schedules,
    });
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
        schedule: createScheduleVersionSchema,
      })
    );
    const schedule = await workspaceRepository.createScheduleVersion(
      user.id,
      body.habitId,
      body.schedule
    );
    return Response.json({ schedule }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
