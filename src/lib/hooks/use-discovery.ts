"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PublicChallenge,
  PublicChallengeProposal,
} from "@/domain/types";
import type { PublicChallengeProposalInput } from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";

export interface DiscoveryConfig {
  configured: boolean;
  contactEmail: string | null;
  policyVersion: string;
}

export interface DiscoveryResponse {
  challenges: PublicChallenge[];
  proposals: PublicChallengeProposal[];
  config: DiscoveryConfig;
}

function keys(userId: string) {
  return {
    challenges: [...workspaceKeys.userRoot(userId), "discovery"] as const,
  };
}

function useInvalidateDiscovery(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.userRoot(userId) });
  };
}

export function useDiscovery(userId: string) {
  return useQuery({
    queryKey: keys(userId).challenges,
    queryFn: () => apiFetch<DiscoveryResponse>("/api/workspace/discovery/challenges"),
  });
}

export function useProposePublicChallenge(userId: string) {
  const invalidate = useInvalidateDiscovery(userId);
  return useMutation({
    mutationFn: (input: PublicChallengeProposalInput) =>
      apiFetch<{ proposal: PublicChallengeProposal }>(
        "/api/workspace/discovery/challenges",
        { method: "POST", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Proposal sent for review", {
        description: "Nothing is public until an allowlisted moderator approves it.",
      });
    },
    onError: (error) =>
      toast.error("Could not propose challenge", { description: errorMessage(error) }),
  });
}

export function useWithdrawPublicChallenge(userId: string) {
  const invalidate = useInvalidateDiscovery(userId);
  return useMutation({
    mutationFn: (challengeId: string) =>
      apiFetch(
        `/api/workspace/discovery/challenges/${encodeURIComponent(challengeId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Proposal withdrawn");
    },
    onError: (error) =>
      toast.error("Could not withdraw proposal", { description: errorMessage(error) }),
  });
}

export function useSetPublicChallengeParticipation(userId: string) {
  const invalidate = useInvalidateDiscovery(userId);
  return useMutation({
    mutationFn: ({ challengeId, joined }: { challengeId: string; joined: boolean }) =>
      apiFetch(
        `/api/workspace/discovery/challenges/${encodeURIComponent(challengeId)}/participation`,
        { method: joined ? "POST" : "DELETE" }
      ),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(variables.joined ? "Joined challenge" : "Left challenge", {
        description: "Your personal progress stays private.",
      });
    },
    onError: (error) =>
      toast.error("Could not update participation", { description: errorMessage(error) }),
  });
}

export function useSetPublicChallengeHidden(userId: string) {
  const invalidate = useInvalidateDiscovery(userId);
  return useMutation({
    mutationFn: ({ challengeId, hidden }: { challengeId: string; hidden: boolean }) =>
      apiFetch(
        `/api/workspace/discovery/challenges/${encodeURIComponent(challengeId)}/hide`,
        { method: hidden ? "POST" : "DELETE" }
      ),
    onSuccess: (_data, variables) => {
      invalidate();
      toast.success(variables.hidden ? "Challenge hidden" : "Challenge restored");
    },
    onError: (error) =>
      toast.error("Could not update hidden challenges", { description: errorMessage(error) }),
  });
}
