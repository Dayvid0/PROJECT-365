"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ModeratorPublicChallenge,
  ModeratorSafetyReport,
  PublicChallengeStatus,
  SafetyReportStatus,
} from "@/domain/types";
import type {
  PublicChallengeDecisionInput,
  SafetyReportReviewInput,
} from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";

function keys(moderatorId: string) {
  return {
    reports: [...workspaceKeys.userRoot(moderatorId), "moderation", "reports"] as const,
    challenges: [...workspaceKeys.userRoot(moderatorId), "moderation", "challenges"] as const,
  };
}

function useInvalidateModeration(moderatorId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.userRoot(moderatorId) });
  };
}

export function useModeratorReports(moderatorId: string) {
  return useQuery({
    queryKey: keys(moderatorId).reports,
    queryFn: () =>
      apiFetch<{ reports: ModeratorSafetyReport[] }>("/api/workspace/moderation/reports"),
  });
}

export function useModeratorChallengeQueue(moderatorId: string) {
  return useQuery({
    queryKey: keys(moderatorId).challenges,
    queryFn: () =>
      apiFetch<{ challenges: ModeratorPublicChallenge[] }>(
        "/api/workspace/moderation/challenges"
      ),
  });
}

export function useUpdateSafetyReport(moderatorId: string) {
  const invalidate = useInvalidateModeration(moderatorId);
  return useMutation({
    mutationFn: ({
      reportId,
      input,
    }: {
      reportId: string;
      input: SafetyReportReviewInput;
    }) =>
      apiFetch<{ report: ModeratorSafetyReport }>(
        `/api/workspace/moderation/reports/${encodeURIComponent(reportId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
      ),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(`Report marked ${variables.input.status}`);
    },
    onError: (error) => toast.error("Could not update report", { description: errorMessage(error) }),
  });
}

export function useDecidePublicChallenge(moderatorId: string) {
  const invalidate = useInvalidateModeration(moderatorId);
  return useMutation({
    mutationFn: ({
      challengeId,
      input,
    }: {
      challengeId: string;
      input: PublicChallengeDecisionInput;
    }) =>
      apiFetch<{ challenge: ModeratorPublicChallenge }>(
        `/api/workspace/moderation/challenges/${encodeURIComponent(challengeId)}`,
        { method: "PATCH", body: JSON.stringify(input) }
      ),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(`Challenge ${statusLabel(variables.input.status)}`);
    },
    onError: (error) => toast.error("Could not review challenge", { description: errorMessage(error) }),
  });
}

function statusLabel(status: PublicChallengeStatus | SafetyReportStatus): string {
  if (status === "active") return "published";
  if (status === "rejected") return "rejected";
  if (status === "retired") return "retired";
  if (status === "proposed") return "returned to review";
  return status;
}
