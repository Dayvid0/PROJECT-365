"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  Circle,
  CircleChallenge,
  CircleComment,
  CircleInvite,
  CircleMember,
  CircleReactionKind,
  CircleReactionSummary,
  CircleReceivedSupport,
  CircleSharedUpdate,
  CircleSummary,
  ShareField,
  ShareFrequency,
  SharePreview,
} from "@/domain/types";
import type {
  CircleChallengeInput,
  CircleChallengeParticipationInput,
  CircleCommentInput,
  CircleCreateInput,
  CircleInviteInput,
  CirclePatchInput,
  CircleReactionInput,
  CircleRoleInput,
} from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";

interface CircleDetail extends CircleSummary {
  members: CircleMember[];
  invites: CircleInvite[];
}

interface InvitePreviewResponse {
  invite: CircleInvite;
  circleDescription: string | null;
  memberCount: number;
  alreadyMember: boolean;
  canAccept: boolean;
}

function keys(userId: string) {
  return {
    circles: [...workspaceKeys.userRoot(userId), "circles"] as const,
    received: [...workspaceKeys.userRoot(userId), "circle-invites", "received"] as const,
    detail: (circleId: string) =>
      [...workspaceKeys.userRoot(userId), "circles", circleId] as const,
    invites: (circleId: string) =>
      [...workspaceKeys.userRoot(userId), "circles", circleId, "invites"] as const,
    shared: (circleId: string) =>
      [...workspaceKeys.userRoot(userId), "circles", circleId, "shared"] as const,
    challenges: (circleId: string) =>
      [...workspaceKeys.userRoot(userId), "circles", circleId, "challenges"] as const,
    receivedSupport: (circleId: string) =>
      [...workspaceKeys.userRoot(userId), "circles", circleId, "support-received"] as const,
  };
}

function useInvalidateCircles(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.userRoot(userId) });
  };
}

export function useCircles(userId: string) {
  return useQuery({
    queryKey: keys(userId).circles,
    queryFn: () => apiFetch<{ circles: CircleSummary[] }>("/api/workspace/circles"),
  });
}

export function useCreateCircle(userId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (input: CircleCreateInput) =>
      apiFetch<{ circle: Circle }>("/api/workspace/circles", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Circle created", {
        description: "Only people you invite by exact email can join.",
      });
    },
    onError: (error) => toast.error("Could not create circle", { description: errorMessage(error) }),
  });
}

export function useCircleDetail(userId: string, circleId: string, enabled = true) {
  return useQuery({
    queryKey: keys(userId).detail(circleId),
    queryFn: () => apiFetch<CircleDetail>(`/api/workspace/circles/${encodeURIComponent(circleId)}`),
    enabled: enabled && Boolean(circleId),
  });
}

export function useUpdateCircle(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (patch: CirclePatchInput) =>
      apiFetch<{ circle: Circle }>(`/api/workspace/circles/${encodeURIComponent(circleId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Circle updated");
    },
    onError: (error) => toast.error("Could not update circle", { description: errorMessage(error) }),
  });
}

export function useDeleteCircle(userId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (circleId: string) =>
      apiFetch(`/api/workspace/circles/${encodeURIComponent(circleId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Circle deleted");
    },
    onError: (error) => toast.error("Could not delete circle", { description: errorMessage(error) }),
  });
}

export function useCircleInvites(userId: string, circleId: string, enabled = true) {
  return useQuery({
    queryKey: keys(userId).invites(circleId),
    queryFn: () =>
      apiFetch<{ invites: CircleInvite[] }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/invites`
      ),
    enabled: enabled && Boolean(circleId),
  });
}

export function useReceivedCircleInvites(userId: string) {
  return useQuery({
    queryKey: keys(userId).received,
    queryFn: () =>
      apiFetch<{ invites: CircleInvite[] }>("/api/workspace/circles/invites"),
  });
}

export function useCircleInviteForViewer(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ["workspace", "circle-invite", token],
    queryFn: () =>
      apiFetch<InvitePreviewResponse>(
        `/api/workspace/circles/invites/${encodeURIComponent(token)}`
      ),
    enabled: enabled && Boolean(token),
  });
}

export function useCreateCircleInvite(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (input: CircleInviteInput) =>
      apiFetch<{ invite: CircleInvite }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/invites`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Circle invite created", {
        description: "Copy the link and send it to the invited email address.",
      });
    },
    onError: (error) => toast.error("Could not create invite", { description: errorMessage(error) }),
  });
}

export function useCancelCircleInvite(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/invites?id=${encodeURIComponent(inviteId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Circle invite cancelled");
    },
    onError: (error) => toast.error("Could not cancel invite", { description: errorMessage(error) }),
  });
}

export function useRespondToCircleInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, accept }: { token: string; accept: boolean }) =>
      apiFetch<{ invite: CircleInvite }>(
        `/api/workspace/circles/invites/${encodeURIComponent(token)}/${accept ? "accept" : "decline"}`,
        { method: "POST" }
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries();
      toast.success(variables.accept ? "Joined circle" : "Circle invite declined");
    },
    onError: (error) =>
      toast.error("Could not update invite", { description: errorMessage(error) }),
  });
}

export function useSetCircleMemberRole(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: CircleRoleInput["role"];
    }) =>
      apiFetch<{ member: CircleMember }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(memberId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ role }),
        }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Member role updated");
    },
    onError: (error) => toast.error("Could not update role", { description: errorMessage(error) }),
  });
}

export function useRemoveCircleMember(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/members/${encodeURIComponent(memberId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Member removed", {
        description: "Their grants, reactions, comments, and challenges in this circle were removed.",
      });
    },
    onError: (error) => toast.error("Could not remove member", { description: errorMessage(error) }),
  });
}

export function useLeaveCircle(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/workspace/circles/${encodeURIComponent(circleId)}/leave`, {
        method: "POST",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Left circle", {
        description: "Your grants and support activity in this circle were removed.",
      });
    },
    onError: (error) => toast.error("Could not leave circle", { description: errorMessage(error) }),
  });
}

export function useCircleSharedUpdates(userId: string, circleId: string, enabled = true) {
  return useQuery({
    queryKey: keys(userId).shared(circleId),
    queryFn: () =>
      apiFetch<{ updates: CircleSharedUpdate[] }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/shared`
      ),
    enabled: enabled && Boolean(circleId),
  });
}

/** Circle grants reuse the exact same preview payload as partner grants. */
export function usePreviewCircleGrant() {
  return useMutation({
    mutationFn: (input: {
      circleId: string;
      habitId: string;
      alias: string | null;
      fields: ShareField[];
      frequency: ShareFrequency;
    }) =>
      apiFetch<{ preview: SharePreview }>("/api/workspace/sharing/preview", {
        method: "POST",
        body: JSON.stringify({
          audience: "circle",
          circleId: input.circleId,
          habitId: input.habitId,
          alias: input.alias,
          fields: input.fields,
          frequency: input.frequency,
          consentVersion: 1,
        }),
      }),
  });
}

export function useSetCircleReaction(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: ({
      grantId,
      kind,
    }: {
      grantId: string;
      kind: CircleReactionKind;
    }) =>
      apiFetch<{ reaction: CircleReactionSummary }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/shared/${encodeURIComponent(grantId)}/reactions`,
        {
          method: "POST",
          body: JSON.stringify({ kind } satisfies CircleReactionInput),
        }
      ),
    onSuccess: invalidate,
  });
}

export function useCreateCircleComment(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: ({
      grantId,
      body,
    }: {
      grantId: string;
      body: string;
    }) =>
      apiFetch<{ comment: CircleComment }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/shared/${encodeURIComponent(grantId)}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body } satisfies CircleCommentInput),
        }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Comment added");
    },
    onError: (error) => toast.error("Could not add comment", { description: errorMessage(error) }),
  });
}

export function useDeleteCircleComment(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: ({ grantId, commentId }: { grantId: string; commentId: string }) =>
      apiFetch(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/shared/${encodeURIComponent(grantId)}/comments?id=${encodeURIComponent(commentId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Comment deleted");
    },
    onError: (error) => toast.error("Could not delete comment", { description: errorMessage(error) }),
  });
}

export function useReceivedCircleSupport(userId: string, circleId: string, enabled = true) {
  return useQuery({
    queryKey: keys(userId).receivedSupport(circleId),
    queryFn: () =>
      apiFetch<{ support: CircleReceivedSupport[] }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/support-received`
      ),
    enabled: enabled && Boolean(circleId),
  });
}

export function useCircleChallenges(userId: string, circleId: string, enabled = true) {
  return useQuery({
    queryKey: keys(userId).challenges(circleId),
    queryFn: () =>
      apiFetch<{ challenges: CircleChallenge[] }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/challenges`
      ),
    enabled: enabled && Boolean(circleId),
  });
}

export function useCreateCircleChallenge(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (input: CircleChallengeInput) =>
      apiFetch<{ challenge: CircleChallenge }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/challenges`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Challenge created", {
        description: "Only current circle members can see it. No progress is published.",
      });
    },
    onError: (error) =>
      toast.error("Could not create challenge", { description: errorMessage(error) }),
  });
}

export function useSetCircleChallengeParticipation(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: ({
      challengeId,
      joined,
    }: {
      challengeId: string;
      joined: boolean;
    }) =>
      apiFetch<{ challenge: CircleChallenge }>(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/challenges/${encodeURIComponent(challengeId)}/participation`,
        {
          method: "POST",
          body: JSON.stringify({ joined } satisfies CircleChallengeParticipationInput),
        }
      ),
    onSuccess: invalidate,
    onError: (error) => toast.error("Could not update challenge", { description: errorMessage(error) }),
  });
}

export function useDeleteCircleChallenge(userId: string, circleId: string) {
  const invalidate = useInvalidateCircles(userId);
  return useMutation({
    mutationFn: (challengeId: string) =>
      apiFetch(
        `/api/workspace/circles/${encodeURIComponent(circleId)}/challenges?id=${encodeURIComponent(challengeId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Challenge deleted");
    },
    onError: (error) => toast.error("Could not delete challenge", { description: errorMessage(error) }),
  });
}
