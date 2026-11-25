"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dedupeLogs } from "@/domain/calculations";
import type {
  AnalyticsRangeData,
  BootstrapData,
  Habit,
  HabitLog,
  MonthlySnapshot,
  UserProfile,
} from "@/domain/types";
import type {
  CreateHabitInput,
  CreateScheduleVersionInput,
  PreferencesPatchSchemaType,
  ProfilePatchInput,
  ScheduleExceptionInput,
  UpdateHabitInput,
} from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

interface LogsResponse {
  logs: HabitLog[];
}

interface SnapshotResponse {
  snapshot: MonthlySnapshot;
}

export interface UpsertVariables {
  month: string;
  logs: HabitLog[];
}

export function useBootstrap(userId: string) {
  return useQuery({
    queryKey: workspaceKeys.bootstrap(userId),
    queryFn: () => apiFetch<BootstrapData>("/api/workspace/bootstrap"),
  });
}

export function useHabits(userId: string) {
  const query = useBootstrap(userId);
  return {
    habits: query.data?.habits ?? [],
    schedules: query.data?.schedules ?? [],
    exceptions: query.data?.exceptions ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useLogs(userId: string, month: string) {
  const query = useQuery({
    queryKey: workspaceKeys.logs(userId, month),
    queryFn: () =>
      apiFetch<LogsResponse>(`/api/workspace/logs?month=${encodeURIComponent(month)}`),
  });
  return {
    logs: query.data?.logs ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSnapshot(userId: string, month: string) {
  return useQuery({
    queryKey: workspaceKeys.snapshot(userId, month),
    queryFn: () =>
      apiFetch<SnapshotResponse>(
        `/api/workspace/snapshots/${encodeURIComponent(month)}`
      ),
    select: (data) => data.snapshot,
  });
}

export function useAnalytics(userId: string, months = 12) {
  return useQuery({
    queryKey: workspaceKeys.analytics(userId, months),
    queryFn: () =>
      apiFetch<AnalyticsRangeData>(`/api/workspace/analytics?months=${months}`),
  });
}

export function useOnlineStatus() {
  return useWorkspaceUIStore((state) => state.isOnline);
}

export function useCreateHabit(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHabitInput) =>
      apiFetch<{ habit: Habit }>("/api/workspace/habits", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.bootstrap(userId) });
      toast.success("Habit created");
    },
    onError: (error) => toast.error("Could not create habit", { description: errorMessage(error) }),
  });
}

export function useUpdateHabit(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateHabitInput & { habitId: string }) => {
      const { habitId, ...patch } = input;
      return apiFetch<{ habit: Habit }>(`/api/workspace/habits/${encodeURIComponent(habitId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.bootstrap(userId) });
      const previous = queryClient.getQueryData<BootstrapData>(workspaceKeys.bootstrap(userId));
      queryClient.setQueryData<BootstrapData>(workspaceKeys.bootstrap(userId), (current) =>
        current
          ? {
              ...current,
              habits: current.habits.map((habit) =>
                habit.id === input.habitId ? { ...habit, ...input, id: habit.id } : habit
              ),
            }
          : current
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(workspaceKeys.bootstrap(userId), context.previous);
      }
      toast.error("Could not update habit", { description: errorMessage(error) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.bootstrap(userId) });
      toast.success("Habit updated");
    },
  });
}

/**
 * Optimistic log writes. A failed write is rolled back in the cache, queued in
 * localStorage, and surfaced with a toast; a successful queue flush is handled
 * by the provider's online bridge.
 */
export function useUpsertLogs(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logs }: UpsertVariables) =>
      apiFetch<{ saved: number }>("/api/workspace/logs", {
        method: "PUT",
        body: JSON.stringify(logs),
      }),
    onMutate: async ({ month, logs }) => {
      const key = workspaceKeys.logs(userId, month);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LogsResponse>(key);
      queryClient.setQueryData<LogsResponse>(key, {
        logs: dedupeLogs([...(previous?.logs ?? []), ...logs]),
      });
      return { previous, month };
    },
    onError: (error, variables, context) => {
      // Offline changes stay visible as pending; a real server rejection is
      // rolled back because it will never be accepted by a later flush.
      if (context?.previous && navigator.onLine) {
        queryClient.setQueryData(workspaceKeys.logs(userId, context.month), context.previous);
      }
      useWorkspaceUIStore.getState().enqueueLogs(variables.logs);
      toast.error("Saved offline", {
        description: `${errorMessage(error)} We'll sync it when you're back online.`,
      });
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.snapshot(userId, variables.month),
      });
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.analytics(userId, 12),
      });
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.bootstrap(userId),
      });
    },
  });
}

function invalidateWorkspaceAnalytics(queryClient: ReturnType<typeof useQueryClient>, userId: string) {
  void queryClient.invalidateQueries({ queryKey: workspaceKeys.bootstrap(userId) });
  void queryClient.invalidateQueries({ queryKey: workspaceKeys.analytics(userId, 12) });
}

export function useCreateScheduleVersion(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScheduleVersionInput & { habitId: string }) => {
      const { habitId, ...schedule } = input;
      return apiFetch<{ schedule: unknown }>("/api/workspace/schedules", {
        method: "POST",
        body: JSON.stringify({ habitId, schedule }),
      });
    },
    onSuccess: () => {
      invalidateWorkspaceAnalytics(queryClient, userId);
      toast.success("Schedule updated");
    },
    onError: (error) => toast.error("Could not update schedule", { description: errorMessage(error) }),
  });
}

export function useCreateException(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleExceptionInput & { habitId: string }) => {
      const { habitId, ...exception } = input;
      return apiFetch<{ exception: unknown }>("/api/workspace/exceptions", {
        method: "POST",
        body: JSON.stringify({ habitId, exception }),
      });
    },
    onSuccess: () => {
      invalidateWorkspaceAnalytics(queryClient, userId);
      toast.success("Break saved");
    },
    onError: (error) => toast.error("Could not save break", { description: errorMessage(error) }),
  });
}

export function useDeleteException(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/workspace/exceptions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidateWorkspaceAnalytics(queryClient, userId);
      toast.success("Break removed");
    },
    onError: (error) => toast.error("Could not remove break", { description: errorMessage(error) }),
  });
}

export function useOnboarding(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: "defaults" | "scratch") =>
      apiFetch<{ habits: Habit[] }>("/api/workspace/onboarding", {
        method: "POST",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.bootstrap(userId) });
      toast.success("You're all set");
    },
    onError: (error) => toast.error("Could not finish setup", { description: errorMessage(error) }),
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatchInput) =>
      apiFetch<{ user: UserProfile }>("/api/workspace/profile", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<BootstrapData>(workspaceKeys.bootstrap(userId), (current) =>
        current ? { ...current, user } : current
      );
      toast.success("Profile saved");
    },
    onError: (error) => toast.error("Could not save profile", { description: errorMessage(error) }),
  });
}

export function useUpdatePreferences(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: PreferencesPatchSchemaType) =>
      apiFetch<{ user: UserProfile }>("/api/workspace/preferences", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData<BootstrapData>(workspaceKeys.bootstrap(userId), (current) =>
        current ? { ...current, user } : current
      );
      toast.success("Preferences saved");
    },
    onError: (error) => toast.error("Could not save preferences", { description: errorMessage(error) }),
  });
}
