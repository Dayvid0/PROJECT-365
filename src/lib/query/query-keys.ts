import type { QueryClient } from "@tanstack/react-query";

/**
 * User-scoped query keys. Every cache entry is partitioned by userId, so
 * switching accounts or signing out cannot leak data across tenants.
 */
export const workspaceKeys = {
  all: ["workspace"] as const,
  userRoot: (userId: string) => ["workspace", userId] as const,
  bootstrap: (userId: string) => ["workspace", userId, "bootstrap"] as const,
  habits: (userId: string) => ["workspace", userId, "bootstrap"] as const,
  logs: (userId: string, month: string) =>
    ["workspace", userId, "logs", month] as const,
  snapshot: (userId: string, month: string) =>
    ["workspace", userId, "snapshot", month] as const,
  analytics: (userId: string, months: number) =>
    ["workspace", userId, "analytics", months] as const,
  weeklyReview: (userId: string, week: string) =>
    ["workspace", userId, "weekly-review", week] as const,
};

export function clearWorkspaceCache(queryClient: QueryClient, userId?: string): void {
  if (userId) {
    queryClient.removeQueries({ queryKey: workspaceKeys.userRoot(userId) });
    return;
  }
  queryClient.clear();
}
