"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { WeeklyReview } from "@/domain/types";
import type { WeeklyNoteInput } from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";

interface WeeklyReviewResponse {
  review: WeeklyReview;
}

interface WeeklyNoteResponse {
  weekStart: string;
  note: string | null;
}

export function useWeeklyReview(userId: string, week: string) {
  return useQuery({
    queryKey: workspaceKeys.weeklyReview(userId, week),
    queryFn: () =>
      apiFetch<WeeklyReviewResponse>(
        `/api/workspace/weekly-review?week=${encodeURIComponent(week)}`
      ),
    enabled: Boolean(week),
  });
}

export function useSaveWeeklyNote(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WeeklyNoteInput) =>
      apiFetch<WeeklyNoteResponse>("/api/workspace/weekly-review", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.weeklyReview(userId, data.weekStart),
      });
      toast.success("Reflection saved privately");
    },
    onError: (error) =>
      toast.error("Could not save reflection", { description: errorMessage(error) }),
  });
}
