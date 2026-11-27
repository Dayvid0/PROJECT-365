"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  PartnerInvite,
  PartnerSummary,
  SafetyControl,
  SafetyReport,
  ShareGrant,
  SharePreview,
} from "@/domain/types";
import type {
  PartnerInviteInput,
  SafetyControlInput,
  SafetyReportInput,
  ShareGrantInput,
} from "@/domain/validation";
import { apiFetch, errorMessage } from "@/lib/api";
import { workspaceKeys } from "@/lib/query/query-keys";

interface InvitesResponse {
  sent: PartnerInvite[];
  received: PartnerInvite[];
}

interface InviteResponse {
  invite: PartnerInvite;
}

interface PartnersResponse {
  partners: PartnerSummary[];
}

interface InviteForViewerResponse {
  invite: PartnerInvite;
  canAccept: boolean;
}

interface GrantsResponse {
  grants: ShareGrant[];
}

interface PreviewResponse {
  preview: SharePreview;
}

interface ControlsResponse {
  controls: SafetyControl[];
}

interface ReportsResponse {
  reports: SafetyReport[];
}

function keys(userId: string) {
  return {
    invites: [...workspaceKeys.userRoot(userId), "partner-invites"] as const,
    partners: [...workspaceKeys.userRoot(userId), "partners"] as const,
    grants: [...workspaceKeys.userRoot(userId), "share-grants"] as const,
    controls: [...workspaceKeys.userRoot(userId), "safety-controls"] as const,
    reports: [...workspaceKeys.userRoot(userId), "safety-reports"] as const,
  };
}

export function usePartnerInvites(userId: string) {
  return useQuery({
    queryKey: keys(userId).invites,
    queryFn: () => apiFetch<InvitesResponse>("/api/workspace/partner/invites"),
  });
}

export function usePartners(userId: string) {
  return useQuery({
    queryKey: keys(userId).partners,
    queryFn: () => apiFetch<PartnersResponse>("/api/workspace/partner/partners"),
  });
}

export function useInviteForViewer(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ["workspace", "partner-invite", token],
    queryFn: () =>
      apiFetch<InviteForViewerResponse>(
        `/api/workspace/partner/invites/${encodeURIComponent(token)}`
      ),
    enabled,
  });
}

export function useShareGrants(userId: string) {
  return useQuery({
    queryKey: keys(userId).grants,
    queryFn: () => apiFetch<GrantsResponse>("/api/workspace/sharing/grants"),
  });
}

export function useSafetyControls(userId: string) {
  return useQuery({
    queryKey: keys(userId).controls,
    queryFn: () => apiFetch<ControlsResponse>("/api/workspace/safety/controls"),
  });
}

export function useSafetyReports(userId: string) {
  return useQuery({
    queryKey: keys(userId).reports,
    queryFn: () => apiFetch<ReportsResponse>("/api/workspace/safety/reports"),
  });
}

function useInvalidateAccountability(userId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: workspaceKeys.userRoot(userId) });
  };
}

export function useCreatePartnerInvite(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (input: PartnerInviteInput) =>
      apiFetch<InviteResponse>("/api/workspace/partner/invites", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Invite created", {
        description: "Copy the link and send it to your partner. They must accept it.",
      });
    },
    onError: (error) => toast.error("Could not create invite", { description: errorMessage(error) }),
  });
}

export function useCancelPartnerInvite(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/workspace/partner/invites?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Invite cancelled");
    },
    onError: (error) => toast.error("Could not cancel invite", { description: errorMessage(error) }),
  });
}

export function useRespondToInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, accept }: { token: string; accept: boolean }) =>
      apiFetch<InviteResponse>(
        `/api/workspace/partner/invites/${encodeURIComponent(token)}/${accept ? "accept" : "decline"}`,
        { method: "POST" }
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries();
      toast.success(variables.accept ? "Partner connected" : "Invite declined");
    },
    onError: (error) =>
      toast.error("Could not update invite", { description: errorMessage(error) }),
  });
}

export function usePreviewShareGrant() {
  return useMutation({
    mutationFn: (input: ShareGrantInput) =>
      apiFetch<PreviewResponse>("/api/workspace/sharing/preview", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useCreateShareGrant(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (input: ShareGrantInput) =>
      apiFetch<{ grant: ShareGrant }>("/api/workspace/sharing/grants", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Sharing enabled", {
        description: "You can revoke this at any time.",
      });
    },
    onError: (error) => toast.error("Could not start sharing", { description: errorMessage(error) }),
  });
}

export function useRevokeShareGrant(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/workspace/sharing/grants/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Sharing revoked", {
        description: "Future updates stop. Already-seen content stays with the recipient.",
      });
    },
    onError: (error) => toast.error("Could not revoke sharing", { description: errorMessage(error) }),
  });
}

export function useSetSafetyControl(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (input: SafetyControlInput) =>
      apiFetch("/api/workspace/safety/controls", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Boundary saved");
    },
    onError: (error) => toast.error("Could not save boundary", { description: errorMessage(error) }),
  });
}

export function useRemoveSafetyControl(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/workspace/safety/controls?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Boundary removed");
    },
    onError: (error) => toast.error("Could not remove boundary", { description: errorMessage(error) }),
  });
}

export function useCreateSafetyReport(userId: string) {
  const invalidate = useInvalidateAccountability(userId);
  return useMutation({
    mutationFn: (input: SafetyReportInput) =>
      apiFetch("/api/workspace/safety/reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Report saved", {
        description: "It is in your history and available to allowlisted moderators for review.",
      });
    },
    onError: (error) => toast.error("Could not save report", { description: errorMessage(error) }),
  });
}
