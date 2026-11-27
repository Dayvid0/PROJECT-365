"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleChallengesPanel } from "@/components/circles/circle-challenges-panel";
import { CircleReceivedSupportPanel } from "@/components/circles/circle-received-support-panel";
import { CircleSupportPanel } from "@/components/circles/circle-support-panel";
import { errorMessage } from "@/lib/api";
import {
  canDeleteCircle,
  canManageCircle,
  canRemoveCircleMember,
} from "@/domain/circles";
import {
  REPORT_CATEGORIES,
  SHARE_FIELDS,
  SHARE_FREQUENCIES,
} from "@/lib/constants";
import type {
  SafetyReportCategory,
  ShareField,
  ShareFrequency,
  SharePreview,
} from "@/domain/types";
import {
  useBootstrap,
} from "@/lib/hooks/use-workspace";
import {
  useCreateSafetyReport,
  useCreateShareGrant,
  useRevokeShareGrant,
  useSetSafetyControl,
  useShareGrants,
} from "@/lib/hooks/use-accountability";
import {
  useCancelCircleInvite,
  useCircleDetail,
  useCircleInvites,
  useCircleSharedUpdates,
  useCreateCircleInvite,
  useDeleteCircle,
  useLeaveCircle,
  usePreviewCircleGrant,
  useReceivedCircleSupport,
  useRemoveCircleMember,
  useSetCircleMemberRole,
  useUpdateCircle,
} from "@/lib/hooks/use-circles";

const FIELD_LABELS: Record<ShareField, string> = {
  name: "Habit name",
  alias: "Alias instead of name",
  status: "Latest check-in status",
  quantity: "Quantity and unit",
  note: "Check-in notes",
  history: "Progress history",
};

const FREQUENCY_LABELS: Record<ShareFrequency, string> = {
  every_check_in: "Every check-in",
  weekly_summary: "Weekly summary",
  milestone_only: "Milestones only",
  none: "No automatic sharing",
};

export default function CircleDetailPage() {
  const params = useParams<{ circleId: string }>();
  const circleId = params.circleId ?? "";
  const router = useRouter();
  const userId = useWorkspaceUserId();

  const detail = useCircleDetail(userId, circleId);
  const canManage = canManageCircle(detail.data?.role ?? null);
  const invites = useCircleInvites(userId, circleId, canManage);
  const shared = useCircleSharedUpdates(userId, circleId);
  const receivedSupport = useReceivedCircleSupport(userId, circleId);
  const bootstrap = useBootstrap(userId);
  const grantsList = useShareGrants(userId);
  const grants = useCreateShareGrant(userId);
  const revokeGrant = useRevokeShareGrant(userId);
  const previewGrant = usePreviewCircleGrant();
  const setControl = useSetSafetyControl(userId);
  const createReport = useCreateSafetyReport(userId);

  const updateCircle = useUpdateCircle(userId, circleId);
  const deleteCircle = useDeleteCircle(userId);
  const createInvite = useCreateCircleInvite(userId, circleId);
  const cancelInvite = useCancelCircleInvite(userId, circleId);
  const setRole = useSetCircleMemberRole(userId, circleId);
  const removeMember = useRemoveCircleMember(userId, circleId);
  const leaveCircle = useLeaveCircle(userId, circleId);

  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [habitId, setHabitId] = useState("");
  const [alias, setAlias] = useState("");
  const [fields, setFields] = useState<ShareField[]>(["status"]);
  const [frequency, setFrequency] = useState<ShareFrequency>("weekly_summary");
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<"circle" | "user" | "content">(
    "circle"
  );
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetUserId, setReportTargetUserId] = useState("");
  const [reportCategory, setReportCategory] = useState<SafetyReportCategory>("other");
  const [reportDetail, setReportDetail] = useState("");

  const circle = detail.data;
  const habits = bootstrap.data?.habits ?? [];
  const memberList = circle?.members ?? [];

  const toggleField = (field: ShareField) => {
    setFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    );
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/app/circles/invites/${token}`
      );
      toast.success("Circle invite link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const reportContent = (request: {
    targetId: string;
    targetUserId: string;
    detail: string;
  }) => {
    setReportTargetType("content");
    setReportTargetId(request.targetId);
    setReportTargetUserId(request.targetUserId);
    setReportCategory("other");
    setReportDetail(request.detail);
    document.getElementById("circle-report-detail")?.focus();
  };

  const showPreview = async () => {
    if (!habitId || !circle || fields.length === 0) {
      toast.error("Choose a habit and at least one field.");
      return;
    }
    try {
      const result = await previewGrant.mutateAsync({
        circleId,
        habitId,
        alias: alias.trim() || null,
        fields,
        frequency,
      });
      setPreview(result.preview);
    } catch (error) {
      toast.error("Could not preview", { description: errorMessage(error) });
    }
  };

  const confirmGrant = async () => {
    if (!habitId || !preview) return;
    try {
      await grants.mutateAsync({
        audience: "circle",
        circleId,
        habitId,
        alias: alias.trim() || null,
        fields,
        frequency,
        consentVersion: 1,
      });
      setPreview(null);
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  const removeCircle = async () => {
    try {
      await deleteCircle.mutateAsync(circleId);
      router.push("/app/circles");
    } catch {
      setConfirmDelete(false);
    }
  };

  const leave = async () => {
    try {
      await leaveCircle.mutateAsync();
      router.push("/app/circles");
    } catch {
      setConfirmLeave(false);
    }
  };

  if (detail.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading circle…</p>;
  }
  if (detail.isError || !circle) {
    return (
      <Card className="max-w-xl border-border bg-card">
        <CardHeader>
          <CardTitle>Circle unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This circle does not exist or you are not a member.
          </p>
          <Button variant="outline" asChild>
            <Link href="/app/circles">Back to circles</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/app/circles" className="text-xs font-medium text-primary hover:underline">
          ← All circles
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{circle.name}</h1>
        <p className="text-sm text-muted-foreground">
          {circle.role} · {circle.memberCount} member{circle.memberCount === 1 ? "" : "s"} ·
          invite-only
        </p>
      </div>

      {canManage ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Circle details</CardTitle>
            <CardDescription>Owners and admins can rename the circle.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="circle-edit-name">Name</Label>
                <Input
                  id="circle-edit-name"
                  maxLength={80}
                  value={nameDraft || circle.name}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="circle-edit-description">Purpose</Label>
                <Input
                  id="circle-edit-description"
                  maxLength={500}
                  value={descriptionDraft || circle.description || ""}
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              disabled={updateCircle.isPending}
              onClick={() => {
                void updateCircle.mutateAsync({
                  name: nameDraft || circle.name,
                  description: descriptionDraft || circle.description,
                });
                setNameDraft("");
                setDescriptionDraft("");
              }}
            >
              Save details
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Members
          </CardTitle>
          <CardDescription>
            Members see who is here. Display names only — no member directory or search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {memberList.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{member.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{member.role}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {circle.role === "owner" && member.userId !== userId && member.role !== "owner" ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        setRole.mutate({ memberId: member.userId, role: value as "admin" | "member" })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Role for ${member.name}`}
                        className="h-8 w-28 text-xs"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="member">member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : null}
                  {member.userId !== userId ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={setControl.isPending}
                        onClick={() =>
                          setControl.mutate({ kind: "mute", targetUserId: member.userId })
                        }
                      >
                        Mute
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={setControl.isPending}
                        onClick={() =>
                          setControl.mutate({ kind: "block", targetUserId: member.userId })
                        }
                      >
                        Block
                      </Button>
                    </>
                  ) : null}
                  {canRemoveCircleMember(
                    circle.role,
                    member.role,
                    member.userId === userId
                  ) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removeMember.isPending}
                      onClick={() => removeMember.mutate(member.userId)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
            <CardDescription>
              Invite by exact email. Your link is shared out of band; there is no user search.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!inviteEmail.trim()) return;
                try {
                  await createInvite.mutateAsync({ email: inviteEmail.trim() });
                  setInviteEmail("");
                } catch {
                  // Toast handled by the mutation hook.
                }
              }}
            >
              <div className="min-w-56 flex-1 space-y-2">
                <Label htmlFor="circle-invite-email">Invitee email</Label>
                <Input
                  id="circle-invite-email"
                  type="email"
                  required
                  maxLength={320}
                  value={inviteEmail}
                  placeholder="friend@example.com"
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={createInvite.isPending}>
                Send invite
              </Button>
            </form>
            <ul className="space-y-2">
              {(invites.data?.invites ?? []).map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                >
                  <span>
                    <span className="font-medium">{invite.inviteeEmail}</span>
                    <span className="ml-2 text-muted-foreground">
                      {invite.status} · expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void copyLink(invite.token)}>
                      <Copy className="size-3.5" /> Copy link
                    </Button>
                    {invite.status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelInvite.mutate(invite.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
              {!invites.data?.invites.length ? (
                <li className="text-xs text-muted-foreground">No invitations yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Share a habit with this circle</CardTitle>
          <CardDescription>
            Preview the exact fields before you agree. Joining the circle alone shares nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="circle-grant-habit">Habit</Label>
              <Select value={habitId} onValueChange={setHabitId}>
                <SelectTrigger id="circle-grant-habit" className="min-h-11 w-full">
                  <SelectValue placeholder="Choose a habit" />
                </SelectTrigger>
                <SelectContent>
                  {habits.map((habit) => (
                    <SelectItem key={habit.id} value={habit.id}>
                      {habit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="circle-grant-alias">Alias (optional)</Label>
              <Input
                id="circle-grant-alias"
                maxLength={80}
                value={alias}
                placeholder="A name members see instead"
                onChange={(event) => setAlias(event.target.value)}
              />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Fields members can see</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SHARE_FIELDS.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={fields.includes(field)}
                    onChange={() => toggleField(field)}
                  />
                  {FIELD_LABELS[field]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="circle-grant-frequency">Sharing frequency</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as ShareFrequency)}
            >
              <SelectTrigger id="circle-grant-frequency" className="min-h-11 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_FREQUENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FREQUENCY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void showPreview()} disabled={previewGrant.isPending}>
            Preview exactly what they&apos;ll see
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>What members chose to share</CardTitle>
          <CardDescription>
            Only active, field-level grants from current members appear here. Supportive reactions
            and replies stay inside this circle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {shared.data?.updates.length ? (
            <ul className="space-y-3">
              {shared.data.updates.map((update) => (
                <li key={update.preview.grantId} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{update.ownerName}</p>
                  <ul className="mt-2 space-y-1">
                    {update.preview.fields.map((field) => (
                      <li key={field.field} className="text-xs text-muted-foreground">
                        <span className="font-medium">{field.label}:</span> {field.value}
                      </li>
                    ))}
                  </ul>
                  <CircleSupportPanel
                    userId={userId}
                    circleId={circleId}
                    update={update}
                    onReport={reportContent}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nothing is visible yet. Members share only after their own preview and consent.
            </p>
          )}
        </CardContent>
      </Card>

      {receivedSupport.data?.support.some(
        (item) =>
          item.interactions.comments.length > 0 ||
          Object.values(item.interactions.reactions.counts).some((count) => count > 0)
      ) ? (
        <CircleReceivedSupportPanel
          userId={userId}
          circleId={circleId}
          support={receivedSupport.data.support}
          onReport={reportContent}
        />
      ) : null}

      <CircleChallengesPanel
        userId={userId}
        circleId={circleId}
        onReport={reportContent}
      />

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Your grants in this circle</CardTitle>
          <CardDescription>Every grant can be revoked here at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {grantsList.data?.grants.length ? (
            <ul className="space-y-2">
              {grantsList.data.grants.map((grant) => {
                if (grant.audience !== "circle" || grant.circleId !== circleId) return null;
                const habitName = habits.find((habit) => habit.id === grant.habitId)?.name ?? "Habit";
                return (
                  <li
                    key={grant.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{habitName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {grant.fields.map((field) => FIELD_LABELS[field]).join(", ")}
                        {grant.revokedAt ? " · revoked" : ""}
                      </span>
                    </span>
                    {grant.revokedAt ? null : (
                      <Button variant="outline" size="sm" onClick={() => setRevokeId(grant.id)}>
                        Revoke
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing is shared right now.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldCheck className="size-4" /> Safety and boundaries
          </CardTitle>
          <CardDescription>
            Always available, even if you never share anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-target-type">Report</Label>
              <Select
                value={reportTargetType}
                onValueChange={(value) => {
                  setReportTargetType(value as "circle" | "user" | "content");
                  setReportTargetId("");
                  setReportTargetUserId("");
                }}
              >
                <SelectTrigger id="report-target-type" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">This circle</SelectItem>
                  <SelectItem value="user">A member</SelectItem>
                  <SelectItem value="content">Shared content</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {reportTargetType === "user" ? (
              <div className="space-y-2">
                <Label htmlFor="report-member">Member</Label>
                <Select value={reportTargetId} onValueChange={setReportTargetId}>
                  <SelectTrigger id="report-member" className="min-h-11 w-full">
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberList
                      .filter((member) => member.userId !== userId)
                      .map((member) => (
                        <SelectItem key={member.userId} value={member.userId}>
                          {member.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {reportTargetType === "content" ? (
              <div className="space-y-2">
                <Label>Shared content</Label>
                <p className="text-xs text-muted-foreground">
                  {reportTargetId
                    ? "A comment or challenge is selected. Add what happened below."
                    : "Use Report on a comment or challenge to select it here."}
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="circle-report-category">Category</Label>
              <Select
                value={reportCategory}
                onValueChange={(value) => setReportCategory(value as SafetyReportCategory)}
              >
                <SelectTrigger id="circle-report-category" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.replaceAll("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="circle-report-detail">What happened?</Label>
            <Input
              id="circle-report-detail"
              maxLength={2000}
              value={reportDetail}
              onChange={(event) => setReportDetail(event.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            disabled={
              !reportDetail.trim() ||
              (reportTargetType === "user" && !reportTargetId) ||
              (reportTargetType === "content" && (!reportTargetId || !reportTargetUserId)) ||
              createReport.isPending
            }
            onClick={() => {
              const targetId = reportTargetType === "circle" ? circleId : reportTargetId;
              createReport.mutate({
                targetType: reportTargetType,
                targetId,
                targetUserId:
                  reportTargetType === "user"
                    ? targetId
                    : reportTargetType === "content"
                      ? reportTargetUserId
                      : null,
                category: reportCategory,
                detail: reportDetail.trim(),
              });
              setReportDetail("");
              setReportTargetId("");
              setReportTargetUserId("");
            }}
          >
            Save report
          </Button>
          <p className="text-xs text-muted-foreground">
            Reports stay visible to you in your history. Allowlisted moderators can review reports
            in the moderation queue; they never see your private habit records.
          </p>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {circle.role !== "owner" ? (
              <Button variant="outline" onClick={() => setConfirmLeave(true)}>
                Leave circle
              </Button>
            ) : null}
            {canDeleteCircle(circle.role) ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete circle
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm exactly what gets shared</DialogTitle>
            <DialogDescription>
              {preview?.audienceLabel ?? "Invite-only circle"} · {preview?.frequencyLabel ?? ""}.
              Nothing else is included.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {preview?.fields.map((field) => (
              <li key={field.field} className="rounded-md border border-border px-3 py-2">
                <span className="block text-xs font-medium text-muted-foreground">{field.label}</span>
                <span>{field.value}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{preview?.revocationNotice}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              <X className="size-4" /> Not now
            </Button>
            <Button onClick={() => void confirmGrant()} disabled={grants.isPending}>
              <Check className="size-4" /> I understand, share this
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this share grant?</DialogTitle>
            <DialogDescription>
              Future access stops immediately. Anything already seen may remain in a member&apos;s
              history or notes and cannot be pulled back from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>Keep sharing</Button>
            <Button
              variant="destructive"
              disabled={revokeGrant.isPending}
              onClick={() => {
                if (!revokeId) return;
                revokeGrant.mutate(revokeId);
                setRevokeId(null);
              }}
            >
              Revoke sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this circle?</DialogTitle>
            <DialogDescription>
              Your membership ends, your sharing grants are revoked, and your reactions, comments,
              and challenges in this circle are removed. You will not see future updates here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>Stay</Button>
            <Button variant="destructive" disabled={leaveCircle.isPending} onClick={() => void leave()}>
              Leave circle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this circle?</DialogTitle>
            <DialogDescription>
              Memberships, invitations, and circle-scoped grants are removed permanently. Your own
              habits and check-ins are untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Keep circle</Button>
            <Button variant="destructive" disabled={deleteCircle.isPending} onClick={() => void removeCircle()}>
              Delete circle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
