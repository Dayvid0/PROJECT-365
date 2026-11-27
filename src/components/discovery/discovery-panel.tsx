"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { EyeOff, Flag, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import styles from "@/components/trust/trust.module.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_CATEGORIES, HABIT_CATEGORIES } from "@/lib/constants";
import type { SafetyReportCategory } from "@/domain/types";
import { useCreateSafetyReport } from "@/lib/hooks/use-accountability";
import {
  useDiscovery,
  useProposePublicChallenge,
  useSetPublicChallengeHidden,
  useSetPublicChallengeParticipation,
  useWithdrawPublicChallenge,
} from "@/lib/hooks/use-discovery";

const CATEGORY_LABELS: Record<(typeof HABIT_CATEGORIES)[number], string> = {
  health: "Health",
  learning: "Learning",
  mindset: "Mindset",
  work: "Work",
  routine: "Routine",
  other: "Other",
};

const REPORT_LABELS: Record<SafetyReportCategory, string> = {
  harassment: "Harassment",
  shame_pressure: "Shame or pressure",
  privacy: "Privacy concern",
  spam: "Spam",
  other: "Other",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DiscoveryPanel({ canModerate }: { canModerate: boolean }) {
  const userId = useWorkspaceUserId();
  const discovery = useDiscovery(userId);
  const propose = useProposePublicChallenge(userId);
  const withdraw = useWithdrawPublicChallenge(userId);
  const participation = useSetPublicChallengeParticipation(userId);
  const hide = useSetPublicChallengeHidden(userId);
  const report = useCreateSafetyReport(userId);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<(typeof HABIT_CATEGORIES)[number]>("routine");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<SafetyReportCategory>("other");
  const [reportDetail, setReportDetail] = useState("");

  const config = discovery.data?.config;
  const configured = config?.configured ?? false;

  const submitProposal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !summary.trim() || !startDate || !endDate || !policyAccepted) return;
    try {
      await propose.mutateAsync({
        title: title.trim(),
        summary: summary.trim(),
        category,
        startsAt: new Date(`${startDate}T00:00:00`).toISOString(),
        endsAt: new Date(`${endDate}T23:59:59`).toISOString(),
        policyAccepted: true,
      });
      setTitle("");
      setSummary("");
      setStartDate("");
      setEndDate("");
      setPolicyAccepted(false);
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>, challengeId: string) => {
    event.preventDefault();
    if (!reportDetail.trim()) return;
    try {
      await report.mutateAsync({
        targetType: "public_challenge",
        targetId: challengeId,
        category: reportCategory,
        detail: reportDetail.trim(),
      });
      setReportingId(null);
      setReportDetail("");
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>MODERATED, NOT PUBLIC PROFILES</span>
          <h1 className={styles.title}>Discover</h1>
          <p className={styles.subtitle}>
            Signed-in, opt-in challenges. No public profiles, user search, direct messages,
            participant names, progress feeds, or rankings.
          </p>
        </div>
      </div>

      <Card className={styles.panelAccent}>
        <CardHeader className="pb-2">
          <CardTitle className={styles.subsectionTitle}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> How public discovery works
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={`${styles.panelDescription} space-y-2`}>
          <p>
            Challenges here are separate from your habits. Joining records only that you opted in;
            it shares no habit name, check-in, note, or progress. Everyone sees the same title,
            summary, dates, and a single participant count.
          </p>
          <p>
            Nothing appears here until an allowlisted moderator approves it. You can hide any
            challenge from your own list, report it for review, or leave it at any time.
          </p>
          {canModerate ? (
            <p>
              <Link href="/app/moderation" className="font-medium text-primary underline underline-offset-2">
                Open the moderation queue
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {!configured ? (
        <Card className={styles.panel}>
          <CardHeader>
            <CardTitle className={styles.panelTitle}>Discovery is waiting for moderation setup</CardTitle>
            <CardDescription className={styles.panelDescription}>
              Public challenges stay hidden until reviewers and a contact address are configured.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.panelDescription}>
            You can keep using private tracking and invite-only circles. No proposal is accepted
            while this gate is closed.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle className={styles.panelTitle}>
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> Propose a public challenge
                </span>
              </CardTitle>
              <CardDescription className={styles.panelDescription}>
                Review exactly what others will see before you send it for moderation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submitProposal(event)}>
                <div className="space-y-2">
                  <Label htmlFor="public-title">Public title</Label>
                  <Input
                    id="public-title"
                    required
                    maxLength={80}
                    value={title}
                    placeholder="Ten quiet minutes each morning"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-category">Category</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as typeof category)}>
                    <SelectTrigger id="public-category" className="min-h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HABIT_CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>{CATEGORY_LABELS[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="public-summary">Shared intention</Label>
                  <Input
                    id="public-summary"
                    required
                    maxLength={500}
                    value={summary}
                    placeholder="A kind, non-competitive intention. No private habit details."
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-start">Starts</Label>
                  <Input
                    id="public-start"
                    type="date"
                    required
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="public-end">Ends</Label>
                  <Input
                    id="public-end"
                    type="date"
                    required
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                <label className={`${styles.consentItem} items-start sm:col-span-2`}>
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={policyAccepted}
                    onChange={(event) => setPolicyAccepted(event.target.checked)}
                  />
                  <span>
                    I confirm this is not tied to a private habit and I accept the community policy
                    (v{config?.policyVersion ?? "current"}). I understand moderators can reject or retire it.
                  </span>
                </label>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={propose.isPending || !policyAccepted}>
                    <Plus className="size-4" /> Send for review
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={styles.panel}>
            <CardHeader>
              <CardTitle className={styles.panelTitle}>Public challenges</CardTitle>
              <CardDescription className={styles.panelDescription}>
                Approved intentions only. Participation is opt-in and anonymous to other members.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {discovery.isPending ? (
                <p className={styles.empty}>Loading challenges…</p>
              ) : discovery.isError ? (
                <p role="alert" className={styles.warning}>
                  Challenges could not be loaded. Please try again.
                </p>
              ) : discovery.data?.challenges.length ? (
                <ul className="space-y-3">
                  {discovery.data.challenges.map((challenge) => (
                    <li key={challenge.id} className={styles.row}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-xl space-y-1">
                          <p className={styles.rowTitle}>{challenge.title}</p>
                          <p className={styles.rowMeta}>
                            {CATEGORY_LABELS[challenge.category]} · {formatDate(challenge.startsAt)} –{" "}
                            {formatDate(challenge.endsAt)}
                          </p>
                          <p className={styles.panelDescription}>{challenge.summary}</p>
                          <p className={styles.rowMeta}>
                            {challenge.participantCount} joined · no names, progress, or ranking
                          </p>
                        </div>
                        <div className={styles.rowActions}>
                          <Button
                            size="sm"
                            variant={challenge.viewerJoined ? "secondary" : "outline"}
                            aria-pressed={challenge.viewerJoined}
                            disabled={participation.isPending}
                            onClick={() =>
                              participation.mutate({
                                challengeId: challenge.id,
                                joined: !challenge.viewerJoined,
                              })
                            }
                          >
                            {challenge.viewerJoined ? "Joined" : "Join"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={hide.isPending}
                            onClick={() => hide.mutate({ challengeId: challenge.id, hidden: true })}
                          >
                            <EyeOff className="size-3.5" /> Hide
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setReportingId(reportingId === challenge.id ? null : challenge.id)
                            }
                          >
                            <Flag className="size-3.5" /> Report
                          </Button>
                        </div>
                      </div>
                      {reportingId === challenge.id ? (
                        <form
                          className={`${styles.consentBox} mt-3 space-y-2`}
                          onSubmit={(event) => void submitReport(event, challenge.id)}
                        >
                          <Label htmlFor={`report-category-${challenge.id}`}>Reason</Label>
                          <Select
                            value={reportCategory}
                            onValueChange={(value) => setReportCategory(value as SafetyReportCategory)}
                          >
                            <SelectTrigger id={`report-category-${challenge.id}`} className="min-h-11 w-full sm:w-72">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REPORT_CATEGORIES.map((value) => (
                                <SelectItem key={value} value={value}>{REPORT_LABELS[value]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label htmlFor={`report-detail-${challenge.id}`}>What should moderators know?</Label>
                          <Input
                            id={`report-detail-${challenge.id}`}
                            required
                            maxLength={2000}
                            value={reportDetail}
                            onChange={(event) => setReportDetail(event.target.value)}
                            placeholder="Describe the concern without sharing private habit details."
                          />
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={report.isPending}>
                              Send report
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setReportingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.empty}>
                  No approved challenges yet. You can propose one above; moderators decide what
                  becomes visible.
                </p>
              )}
            </CardContent>
          </Card>

          {discovery.data?.proposals.length ? (
            <Card className={styles.panel}>
              <CardHeader>
                <CardTitle className={styles.panelTitle}>Your proposals</CardTitle>
                <CardDescription className={styles.panelDescription}>Pending proposals are visible only to you and moderators.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {discovery.data.proposals.map((proposal) => (
                    <li key={proposal.id} className={`${styles.row} text-sm`}>
                      <div>
                        <p className={styles.rowTitle}>{proposal.title}</p>
                        <p className={styles.rowMeta}>
                          <Badge variant="secondary">{proposal.status}</Badge>
                          {proposal.reviewNote ? ` · ${proposal.reviewNote}` : ""}
                        </p>
                      </div>
                      {proposal.canWithdraw ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={withdraw.isPending}
                          onClick={() => withdraw.mutate(proposal.id)}
                        >
                          Withdraw
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Community rules and escalation</CardTitle>
          <CardDescription className={styles.panelDescription}>What moderators do, and what they do not do.</CardDescription>
        </CardHeader>
        <CardContent className={`${styles.panelDescription} space-y-2`}>
          <p>
            Keep intentions kind, non-competitive, and age-appropriate. No shaming, pressure,
            harassment, spam, private habit details, or claims about other people&apos;s progress.
          </p>
          <p>
            Moderators review proposals and reports, and can reject, retire, or keep a challenge.
            They cannot see your private habits, weekly reviews, or check-in history. They do not
            run leaderboards or mediate direct messages, because those do not exist here.
          </p>
          <p>
            Reports are reviewed by the configured allowlist. Response times depend on volunteer
            reviewer availability; urgent safety concerns should use your local emergency services.
          </p>
          <p>
            Appeal a decision by emailing{" "}
            {config?.contactEmail ? (
              <span className="font-medium text-foreground">{config.contactEmail}</span>
            ) : (
              "the configured moderator contact"
            )}{" "}
            with the challenge ID and a short explanation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
