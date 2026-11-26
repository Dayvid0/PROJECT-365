"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

/** Deleting the account also discards the local queue so nothing survives the session. */
export function useDeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (confirmation: string) =>
      apiFetch<{ deleted: boolean }>("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      }),
    onSuccess: async () => {
      useWorkspaceUIStore.getState().clearPending();
      queryClient.clear();
      toast.success("Account deleted");
      router.replace("/");
      router.refresh();
    },
    onError: (error) => toast.error("Could not delete account", { description: errorMessage(error) }),
  });
}
