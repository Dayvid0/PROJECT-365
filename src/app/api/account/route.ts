import { deleteAccountSchema } from "@/domain/validation";
import { auth } from "@/server/auth";
import { requireSession } from "@/server/dal/auth-guard";
import { ValidationError } from "@/server/dal/errors";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { readJson, routeErrorResponse } from "@/server/http/responses";

export const dynamic = "force-dynamic";

/** Permanently removes one account and everything it owns, then clears its session cookies. */
export async function DELETE(request: Request) {
  try {
    const { user } = await requireSession();
    const { confirmation } = await readJson(request, deleteAccountSchema);

    if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
      throw new ValidationError("Confirmation must match your account email.");
    }

    await workspaceRepository.deleteAccount(user.id, user.email);
    const { headers } = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });

    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
