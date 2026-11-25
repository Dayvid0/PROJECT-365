import { z } from "zod";
import { habitReminderSchema } from "@/domain/validation";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireSession();
    return Response.json({ reminders: await workspaceRepository.listReminders(user.id) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireSession();
    const body = await readJson(
      request,
      z.object({
        habitId: z.string().min(1),
        reminder: habitReminderSchema,
      })
    );
    const reminder = await workspaceRepository.upsertReminder(
      user.id,
      body.habitId,
      body.reminder
    );
    return Response.json({ reminder });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
