"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, HeartHandshake, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import styles from "@/components/trust/trust.module.css";
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
import { errorMessage } from "@/lib/api";
import {
  useBootstrap,
} from "@/lib/hooks/use-workspace";
import {
  useCancelPartnerInvite,
  useCreatePartnerInvite,
  useCreateSafetyReport,
  useCreateShareGrant,
  usePartnerInvites,
  usePartners,
  usePreviewShareGrant,
  useRemoveSafetyControl,
  useRevokeShareGrant,
  useSafetyControls,
  useSafetyReports,
  useSetSafetyControl,
  useShareGrants,
} from "@/lib/hooks/use-accountability";
import {
  REPORT_CATEGORIES,
  SAFETY_CONTROL_KINDS,
  SHARE_FIELDS,
  SHARE_FREQUENCIES,
} from "@/lib/constants";
import type {
  SafetyControlKind,
  SafetyReportCategory,
  ShareField,
  ShareFrequency,
  SharePreview,
} from "@/domain/types";

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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AccountabilityPage() {
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const habits = bootstrap?.habits ?? [];
  const invites = usePartnerInvites(userId);
  const partners = usePartners(userId);
  const grants = useShareGrants(userId);
  const controls = useSafetyControls(userId);
  const reports = useSafetyReports(userId);

  const createInvite = useCreatePartnerInvite(userId);
  const cancelInvite = useCancelPartnerInvite(userId);
  const previewGrant = usePreviewShareGrant();
  const createGrant = useCreateShareGrant(userId);
  const revokeGrant = useRevokeShareGrant(userId);
  const setControl = useSetSafetyControl(userId);
  const removeControl = useRemoveSafetyControl(userId);
  const createReport = useCreateSafetyReport(userId);

  const [inviteEmail, setInviteEmail] = useState("");
  const [habitId, setHabitId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [alias, setAlias] = useState("");
  const [fields, setFields] = useState<ShareField[]>(["status"]);
  const [frequency, setFrequency] = useState<ShareFrequency>("weekly_summary");
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [controlKind, setControlKind] = useState<SafetyControlKind>("block");
  const [controlTarget, setControlTarget] = useState("");
  const [reportTarget, setReportTarget] = useState("");
  const [reportCategory, setReportCategory] = useState<SafetyReportCategory>("other");
  const [reportDetail, setReportDetail] = useState("");

  const partnerList = partners.data?.partners ?? [];
  const selectedHabit = habits.find((habit) => habit.id === habitId);
  const selectedPartner = partnerList.find((partner) => partner.userId === partnerId);

  const toggleField = (field: ShareField) => {
    setFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    );
  };

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/app/accountability/invites/${token}`
      );
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy link", { description: "Copy it from the invite list instead." });
    }
  };

  const showPreview = async () => {
    if (!selectedHabit || !selectedPartner || fields.length === 0) {
      toast.error("Choose a habit, a partner, and at least one field.");
      return;
    }
    try {
      const result = await previewGrant.mutateAsync({
        audience: "partner",
        recipientId: selectedPartner.userId,
        habitId: selectedHabit.id,
        alias: alias.trim() || null,
        fields,
        frequency,
        consentVersion: 1,
      });
      setPreview(result.preview);
    } catch (error) {
      toast.error("Could not preview", { description: errorMessage(error) });
    }
  };

  const confirmGrant = async () => {
    if (!selectedHabit || !selectedPartner || !preview) return;
    try {
      await createGrant.mutateAsync({
        audience: "partner",
        recipientId: selectedPartner.userId,
        habitId: selectedHabit.id,
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

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>CONSENT BEFORE CONNECTION</span>
          <h1 className={styles.title}>Accountability</h1>
          <p className={styles.subtitle}>
            Private by default. Share only what you choose, with someone who accepted your invite.
          </p>
        </div>
      </div>

      <Card className={styles.panelAccent}>
        <CardHeader className="pb-2">
          <CardTitle className={styles.subsectionTitle}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Your boundaries come first
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.panelDescription}>
            This accountability area has no public profile or user search. A partner is connected
            only when they accept a link you send them. Every shared field needs your explicit preview
            and confirmation, and revoking stops all future sharing. Skips and planned breaks are
            never treated as failures.
          </p>
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>
            <span className="flex items-center gap-2">
              <HeartHandshake className="size-4 text-primary" /> Trusted partner
            </span>
          </CardTitle>
          <CardDescription className={styles.panelDescription}>
            Invite by exact email address. Your partner must sign in with that address to accept.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
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
              <Label htmlFor="invite-email">Partner email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                maxLength={320}
                placeholder="partner@example.com"
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={createInvite.isPending}>Send invite</Button>
          </form>

          <div className="space-y-2">
            <h3 className={styles.subsectionTitle}>Connected partners</h3>
            {partnerList.length === 0 ? (
              <p className={styles.empty}>No partners yet. Solo tracking works fully on its own.</p>
            ) : (
              <ul className={styles.rowList}>
                {partnerList.map((partner) => (
                  <li key={`${partner.userId}-${partner.direction}`} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{partner.name}</span>
                      <span className={styles.rowMeta}>{partner.email}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      {partner.direction === "invited" ? "You invited them" : "They invited you"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h3 className={styles.subsectionTitle}>Sent invites</h3>
            {invites.data?.sent.length ? (
              <ul className={styles.rowList}>
                {invites.data.sent.map((invite) => (
                  <li key={invite.id} className={`${styles.row} text-xs`}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{invite.inviteeEmail}</span>
                      <span className={styles.rowMeta}>
                        {invite.status} · expires {formatDate(invite.expiresAt)}
                      </span>
                    </span>
                    <span className={styles.rowActions}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void copyInviteLink(invite.token)}
                      >
                        <Copy className="size-3.5" /> Copy link
                      </Button>
                      {invite.status === "pending" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cancelInvite.isPending}
                          onClick={() => cancelInvite.mutate(invite.id)}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No invites sent yet.</p>
            )}
          </div>

          {invites.data?.received.length ? (
            <div className="space-y-2">
              <h3 className={styles.subsectionTitle}>Invites waiting for you</h3>
              <ul className={styles.rowList}>
                {invites.data.received.map((invite) => (
                  <li key={invite.id} className={`${styles.row} text-xs`}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{invite.inviterName}</span>
                      <span className={styles.rowMeta}>
                        invited you · expires {formatDate(invite.expiresAt)}
                      </span>
                    </span>
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/app/accountability/invites/${invite.token}`}
                    >
                      Review invite
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Share a habit</CardTitle>
          <CardDescription className={styles.panelDescription}>
            Preview the exact fields before you agree. Notes and history are never shared by
            default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={styles.formGrid}>
            <div className="space-y-2">
              <Label htmlFor="grant-habit">Habit</Label>
              <Select value={habitId} onValueChange={setHabitId}>
                <SelectTrigger id="grant-habit" className="min-h-11 w-full">
                  <SelectValue placeholder="Choose a habit" />
                </SelectTrigger>
                <SelectContent>
                  {habits.map((habit) => (
                    <SelectItem key={habit.id} value={habit.id}>{habit.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-partner">Partner</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger id="grant-partner" className="min-h-11 w-full">
                  <SelectValue placeholder="Choose a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partnerList.map((partner) => (
                    <SelectItem key={partner.userId} value={partner.userId}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grant-alias">Alias (optional)</Label>
            <Input
              id="grant-alias"
              value={alias}
              maxLength={80}
              placeholder="A name your partner will see instead"
              onChange={(event) => setAlias(event.target.value)}
            />
            <p className={styles.rowMeta}>
              Select “Alias instead of name” below to use it.
            </p>
          </div>

          <fieldset className={styles.consentBox}>
            <legend className={styles.subsectionTitle}>Fields they can see</legend>
            <div className={styles.consentGrid}>
              {SHARE_FIELDS.map((field) => (
                <label key={field} className={styles.consentItem}>
                  <input
                    type="checkbox"
                    checked={fields.includes(field)}
                    onChange={() => toggleField(field)}
                  />
                  {FIELD_LABELS[field]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="grant-frequency">Sharing frequency</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(value as ShareFrequency)}
            >
              <SelectTrigger id="grant-frequency" className="min-h-11 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_FREQUENCIES.map((value) => (
                  <SelectItem key={value} value={value}>{FREQUENCY_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => void showPreview()} disabled={previewGrant.isPending}>
            Preview exactly what they&apos;ll see
          </Button>
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Active sharing</CardTitle>
          <CardDescription className={styles.panelDescription}>Every grant can be revoked here at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          {grants.data?.grants.length ? (
            <ul className={styles.rowList}>
              {grants.data.grants.map((grant) => {
                const habitName = habits.find((habit) => habit.id === grant.habitId)?.name ?? "Habit";
                const partnerName =
                  partnerList.find((partner) => partner.userId === grant.recipientId)?.name ??
                  "Partner";
                return (
                  <li key={grant.id} className={`${styles.row} text-sm`}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{habitName}</span>
                      <span className={styles.rowMeta}>
                        with {partnerName} · {grant.fields.map((field) => FIELD_LABELS[field]).join(", ")}
                      </span>
                      {grant.revokedAt ? (
                        <span className={styles.rowMeta}>Revoked</span>
                      ) : null}
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
            <p className={styles.empty}>Nothing is shared right now.</p>
          )}
        </CardContent>
      </Card>

      <Card className={styles.panelSafety}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Safety controls</CardTitle>
          <CardDescription className={styles.panelDescription}>
            These are always available, even if you never share anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className={styles.formGrid}>
            <div className="space-y-2">
              <Label htmlFor="control-kind">Boundary</Label>
              <Select
                value={controlKind}
                onValueChange={(value) => setControlKind(value as SafetyControlKind)}
              >
                <SelectTrigger id="control-kind" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFETY_CONTROL_KINDS.filter((kind) => kind !== "leave").map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind === "block" ? "Block partner" : "Mute partner"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="control-target">Partner</Label>
              <Select value={controlTarget} onValueChange={setControlTarget}>
                <SelectTrigger id="control-target" className="min-h-11 w-full">
                  <SelectValue placeholder="Choose a partner" />
                </SelectTrigger>
                <SelectContent>
                  {partnerList.map((partner) => (
                    <SelectItem key={partner.userId} value={partner.userId}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={!controlTarget || setControl.isPending}
            onClick={() => {
              setControl.mutate({ kind: controlKind, targetUserId: controlTarget });
            }}
          >
            Save boundary
          </Button>

          {controls.data?.controls.length ? (
            <ul className={`${styles.rowList} border-t border-border pt-4`}>
              {controls.data.controls.map((control) => (
                <li key={control.id} className={`${styles.row} text-xs`}>
                  <span className={styles.rowMeta}>
                    {control.kind}
                    {control.expiresAt ? ` · until ${formatDate(control.expiresAt)}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeControl.mutate(control.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className={styles.subsectionTitle}>Report a problem</h3>
            <div className={styles.formGrid}>
              <div className="space-y-2">
                <Label htmlFor="report-target">Partner</Label>
                <Select value={reportTarget} onValueChange={setReportTarget}>
                  <SelectTrigger id="report-target" className="min-h-11 w-full">
                    <SelectValue placeholder="Choose a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partnerList.map((partner) => (
                      <SelectItem key={partner.userId} value={partner.userId}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-category">Category</Label>
                <Select
                  value={reportCategory}
                  onValueChange={(value) => setReportCategory(value as SafetyReportCategory)}
                >
                  <SelectTrigger id="report-category" className="min-h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{category.replaceAll("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-detail">What happened?</Label>
              <Input
                id="report-detail"
                value={reportDetail}
                maxLength={2000}
                onChange={(event) => setReportDetail(event.target.value)}
              />
            </div>
            <Button
              variant="destructive"
              disabled={!reportTarget || !reportDetail.trim() || createReport.isPending}
              onClick={() => {
                createReport.mutate({
                  targetType: "user",
                  targetId: reportTarget,
                  targetUserId: reportTarget,
                  category: reportCategory,
                  detail: reportDetail.trim(),
                });
                setReportDetail("");
              }}
            >
              Save report
            </Button>
            <p className={styles.note}>
              Reports stay visible to you in your history. Allowlisted moderators can review them in
              the moderation queue; they never see your private habit records.
            </p>
            {reports.data?.reports.length ? (
              <ul className={`${styles.rowList} border-t border-border pt-3`}>
                {reports.data.reports.map((report) => (
                  <li key={report.id} className={`${styles.row} text-xs`}>
                    {report.category} · {report.status} · {formatDate(report.createdAt)}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className={styles.panel}>
          <DialogHeader>
            <DialogTitle className={styles.panelTitle}>Confirm exactly what gets shared</DialogTitle>
            <DialogDescription className={styles.panelDescription}>
              {preview?.audienceLabel ?? "Partner"} · {preview?.frequencyLabel ?? ""}. Nothing else
              is included.
            </DialogDescription>
          </DialogHeader>
          <ul className={`${styles.previewList} text-sm`}>
            {preview?.fields.map((field) => (
              <li key={field.field} className={styles.previewRow}>
                <span className={styles.previewLabel}>{field.label}</span>
                <span className={styles.previewValue}>{field.value}</span>
              </li>
            ))}
          </ul>
          <p className={styles.safetyNote}>{preview?.revocationNotice}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              <X className="size-4" /> Not now
            </Button>
            <Button onClick={() => void confirmGrant()} disabled={createGrant.isPending}>
              <Check className="size-4" /> I understand, share this
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(revokeId)} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent className={styles.panel}>
          <DialogHeader>
            <DialogTitle className={styles.panelTitle}>Revoke this share grant?</DialogTitle>
            <DialogDescription className={styles.panelDescription}>
              Future access stops immediately. Anything already seen may remain in your
              partner&apos;s history or notes, and cannot be pulled back from here.
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
    </div>
  );
}
