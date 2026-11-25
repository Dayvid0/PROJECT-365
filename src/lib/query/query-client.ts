import { isServer, QueryClient } from "@tanstack/react-query";

export const WORKSPACE_STALE_TIME_MS = 60_000;
export const WORKSPACE_GC_TIME_MS = 10 * 60_000;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: WORKSPACE_STALE_TIME_MS,
        gcTime: WORKSPACE_GC_TIME_MS,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const status =
            typeof error === "object" && error !== null && "status" in error
              ? (error as { status?: number }).status
              : undefined;
          if (status && [400, 401, 403, 404].includes(status)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
        // Offline writes must fail fast so the UI can queue them visibly.
        // The default "online" mode silently pauses mutations, which would
        // leave optimistic cells looking saved without an error or queue.
        networkMode: "always",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** One browser client per tab; a fresh client for every server render. */
export function getBrowserQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
