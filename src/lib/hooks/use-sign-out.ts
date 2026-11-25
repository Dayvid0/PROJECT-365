"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { errorMessage } from "@/lib/api";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

/**
 * Local sign-out is never blocked by a failed queue flush or a flaky network.
 * The queued writes are discarded so they cannot leak into the next session.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async function signOut(): Promise<void> {
    try {
      await authClient.signOut();
    } catch (error) {
      toast.error("Signed out locally", {
        description: errorMessage(error),
      });
    }

    useWorkspaceUIStore.getState().clearPending();
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  };
}
