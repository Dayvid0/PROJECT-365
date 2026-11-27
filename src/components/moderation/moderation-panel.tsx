"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import styles from "@/components/trust/trust.module.css";
import {
  canTransitionPublicChallengeStatus,
  canTransitionSafetyReportStatus,
} from "@/domain/moderation";
import type {
  ModeratorPublicChallenge,
  ModeratorSafetyReport,
  PublicChallengeStatus,
  SafetyReportStatus,
} from "@/domain/types";
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
import {
  useDecidePublicChallenge,
  useModeratorChallengeQueue,
  useModeratorReports,
  useUpdateSafetyReport,
} from "@/lib/hooks/use-moderation";

const REPORT_STATUSES: SafetyReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const CHALLENGE_STATUSES: PublicChallengeStatus[] = ["active", "rejected", "retired"];

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ModerationPanel({ moderatorId }: { moderatorId: string }) {
  const reports = useModeratorReports(moderatorId);
  const challenges = useModeratorChallengeQueue(moderatorId);
  const updateReport = useUpdateSafetyReport(moderatorId);
  const decide = useDecidePublicChallenge(moderatorId);

  const [reportStatus, setReportStatus] = useState<Record<string, SafetyReportStatus>>({});
  const [reportNote, setReportNote] = useState<Record<string, string>>({});
  const [challengeStatus, setChallengeStatus] = useState<Record<string, PublicChallengeStatus>>({});
  const [challengeNote, setChallengeNote] = useState<Record<string, string>>({});

  const reviewReport = async (report: ModeratorSafetyReport) => {
    const status = reportStatus[report.id] ?? "reviewing";
    if (!canTransitionSafetyReportStatus(report.status, status)) return;
    try {
      await updateReport.mutateAsync({
        reportId: report.id,
        input: { status, note: reportNote[report.id]?.trim() || null },
      });
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  const decideChallenge = async (challenge: ModeratorPublicChallenge) => {
    const status = challengeStatus[challenge.id] ?? "active";
    if (!canTransitionPublicChallengeStatus(challenge.status, status)) return;
    try {
      await decide.mutateAsync({
        challengeId: challenge.id,
        input: { status, note: challengeNote[challenge.id]?.trim() || null },
      });
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>ALLOWLISTED REVIEW ONLY</span>
          <h1 className={styles.title}>Moderation</h1>
          <p className={styles.subtitle}>
            Review only. Private habits, notes, weekly reviews, and check-in history are never part of
            this queue.
          </p>
        </div>
      </div>

      <Card className={styles.panelAccent}>
        <CardHeader className="pb-2">
          <CardTitle className={styles.subsectionTitle}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Review boundaries
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={styles.panelDescription}>
          Approve only intentions that are kind, non-competitive, and free of private habit
          details. Reporter identities appear here only; they are never shown in discovery. See
          <Link href="/app/discover" className="mx-1 underline underline-offset-2">
            community rules
          </Link>
          for enforcement scope and escalation.
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Challenge proposals</CardTitle>
          <CardDescription className={styles.panelDescription}>Approve, reject, or retire public challenges.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {challenges.isPending ? (
            <p className={styles.rowMeta}>Loading queue…</p>
          ) : challenges.isError ? (
            <p role="alert" className={styles.warning}>The queue could not be loaded.</p>
          ) : challenges.data?.challenges.length ? (
            <ul className="space-y-3">
              {challenges.data.challenges.map((challenge) => (
                <li key={challenge.id} className={`${styles.row} flex-col items-stretch`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="max-w-xl space-y-1">
                      <p className={styles.rowTitle}>{challenge.title}</p>
                      <p className={styles.rowMeta}>
                        <Badge variant="secondary">{challenge.status}</Badge> ·{" "}
                        {challenge.category} · {formatDate(challenge.startsAt)} –{" "}
                        {formatDate(challenge.endsAt)}
                      </p>
                      <p className={styles.panelDescription}>{challenge.summary}</p>
                      <p className={styles.rowMeta}>
                        Proposed by {challenge.proposerEmail ?? "a deleted account"} ·{" "}
                        {challenge.participantCount} joined · policy v{challenge.policyVersion}
                        {challenge.reviewedByEmail ? ` · reviewed by ${challenge.reviewedByEmail}` : ""}
                      </p>
                      {challenge.reviewNote ? (
                        <p className={styles.rowMeta}>Note: {challenge.reviewNote}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
                    <div className="space-y-1">
                      <Label htmlFor={`challenge-decision-${challenge.id}`}>Decision</Label>
                      <Select
                        value={challengeStatus[challenge.id] ?? "active"}
                        onValueChange={(value) =>
                          setChallengeStatus((current) => ({
                            ...current,
                            [challenge.id]: value as PublicChallengeStatus,
                          }))
                        }
                      >
                        <SelectTrigger id={`challenge-decision-${challenge.id}`} className="min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHALLENGE_STATUSES.filter((status) =>
                            canTransitionPublicChallengeStatus(challenge.status, status)
                          ).map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`challenge-note-${challenge.id}`}>Review note (optional)</Label>
                      <Input
                        id={`challenge-note-${challenge.id}`}
                        maxLength={500}
                        value={challengeNote[challenge.id] ?? ""}
                        onChange={(event) =>
                          setChallengeNote((current) => ({
                            ...current,
                            [challenge.id]: event.target.value,
                          }))
                        }
                        placeholder="Visible to the proposer"
                      />
                    </div>
                    <Button
                      disabled={
                        decide.isPending ||
                        !canTransitionPublicChallengeStatus(
                          challenge.status,
                          challengeStatus[challenge.id] ?? "active"
                        )
                      }
                      onClick={() => void decideChallenge(challenge)}
                    >
                      Apply
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.rowMeta}>No proposals to review.</p>
          )}
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Safety reports</CardTitle>
          <CardDescription className={styles.panelDescription}>Open, in-review, and closed reports across the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reports.isPending ? (
            <p className={styles.rowMeta}>Loading reports…</p>
          ) : reports.isError ? (
            <p role="alert" className={styles.warning}>Reports could not be loaded.</p>
          ) : reports.data?.reports.length ? (
            <ul className="space-y-3">
              {reports.data.reports.map((report) => (
                <li key={report.id} className={`${styles.row} flex-col items-stretch`}>
                  <div className="space-y-1 text-sm">
                    <p className={styles.rowTitle}>
                      <Badge variant="secondary">{report.status}</Badge> · {report.category} ·{" "}
                      {formatDate(report.createdAt)}
                    </p>
                    <p className={styles.rowMeta}>
                      Reported by {report.reporterEmail ?? "a deleted account"} · target{" "}
                      {report.targetType}
                      {report.targetSummary ? `: ${report.targetSummary}` : `: ${report.targetId}`}
                      {report.reviewedByEmail ? ` · reviewed by ${report.reviewedByEmail}` : ""}
                    </p>
                    <p className={styles.previewValue}>{report.detail}</p>
                    {report.reviewNote ? (
                      <p className={styles.rowMeta}>Note: {report.reviewNote}</p>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto] sm:items-end">
                    <div className="space-y-1">
                      <Label htmlFor={`report-status-${report.id}`}>Status</Label>
                      <Select
                        value={reportStatus[report.id] ?? "reviewing"}
                        onValueChange={(value) =>
                          setReportStatus((current) => ({
                            ...current,
                            [report.id]: value as SafetyReportStatus,
                          }))
                        }
                      >
                        <SelectTrigger id={`report-status-${report.id}`} className="min-h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REPORT_STATUSES.filter((status) =>
                            canTransitionSafetyReportStatus(report.status, status)
                          ).map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`report-note-${report.id}`}>Resolution note (optional)</Label>
                      <Input
                        id={`report-note-${report.id}`}
                        maxLength={500}
                        value={reportNote[report.id] ?? ""}
                        onChange={(event) =>
                          setReportNote((current) => ({
                            ...current,
                            [report.id]: event.target.value,
                          }))
                        }
                        placeholder="Visible to the reporter"
                      />
                    </div>
                    <Button
                      disabled={
                        updateReport.isPending ||
                        !canTransitionSafetyReportStatus(
                          report.status,
                          reportStatus[report.id] ?? "reviewing"
                        )
                      }
                      onClick={() => void reviewReport(report)}
                    >
                      Apply
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.rowMeta}>No reports to review.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
