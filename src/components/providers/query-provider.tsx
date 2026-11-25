"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api";
import { getBrowserQueryClient } from "@/lib/query/query-client";
import { workspaceKeys } from "@/lib/query/query-keys";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

function ConnectivityBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const store = useWorkspaceUIStore;
    const syncOnline = () => store.getState().setIsOnline(navigator.onLine);
    let flushing = false;

    const flushPending = async () => {
      const pending = store.getState().pendingLogs;
      if (flushing || !pending.length || !navigator.onLine) return;
      flushing = true;

      try {
        await apiFetch<{ saved: number }>("/api/workspace/logs", {
          method: "PUT",
          body: JSON.stringify(pending),
        });
        store.getState().removeLogs(pending);
        void queryClient.invalidateQueries({ queryKey: ["workspace"] });
        toast.success("Saved", {
          description: `${pending.length} offline change${pending.length === 1 ? "" : "s"} synced.`,
        });
      } catch (error) {
        toast.error("Could not sync offline changes", {
          description: errorMessage(error),
        });
      } finally {
        flushing = false;
      }
    };

    const onOnline = () => {
      syncOnline();
      void flushPending();
    };
    const onOffline = () => syncOnline();

    syncOnline();
    void flushPending();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [queryClient]);

  return null;
}

/** React Query client, offline status tracking, and best-effort queue flush. */
export function WorkspaceQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => getBrowserQueryClient());

  useEffect(() => {
    void useWorkspaceUIStore.persist?.rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectivityBridge />
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      ) : null}
    </QueryClientProvider>
  );
}

export { workspaceKeys };
