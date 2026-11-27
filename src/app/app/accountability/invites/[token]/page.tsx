"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
import { errorMessage } from "@/lib/api";
import { useBootstrap } from "@/lib/hooks/use-workspace";
import { useInviteForViewer, useRespondToInvite } from "@/lib/hooks/use-accountability";

export default function InviteReviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const invite = useInviteForViewer(token, Boolean(token));
  const respond = useRespondToInvite();
  const [reply, setReply] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respondToInvite = async (accept: boolean) => {
    setError(null);
    try {
      await respond.mutateAsync({ token, accept });
      setReply(accept ? "accepted" : "declined");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  if (invite.isLoading) {
    return <p className={styles.empty}>Loading invite…</p>;
  }
  if (invite.isError || !invite.data) {
    return (
      <Card className={`${styles.narrowPage} ${styles.panel}`}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Invite unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className={styles.panelDescription}>
            This link is invalid, expired, or no longer available.
          </p>
          <Button variant="outline" asChild>
            <Link href="/app/accountability">Back to accountability</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const signedInEmail = bootstrap?.user?.email ?? "";
  const emailMatches =
    signedInEmail.trim().toLowerCase() ===
    invite.data.invite.inviteeEmail.trim().toLowerCase();

  return (
    <div className={styles.narrowPage}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>REVIEW BEFORE YOU CONNECT</span>
          <h1 className={styles.title}>Partner invite</h1>
          <p className={styles.subtitle}>
            Accepting only connects you. Sharing still needs a separate preview and confirmation.
          </p>
        </div>
      </div>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> {invite.data.invite.inviterName}
            </span>
          </CardTitle>
          <CardDescription className={styles.panelDescription}>
            Invited {invite.data.invite.inviteeEmail} · expires{" "}
            {new Date(invite.data.invite.expiresAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reply ? (
            <div className="space-y-3">
              <p className="text-sm">
                {reply === "accepted"
                  ? "Connected. You can now choose what, if anything, to share."
                  : "Invite declined. Nothing was shared."}
              </p>
              <Button asChild>
                <Link href="/app/accountability">Go to accountability</Link>
              </Button>
            </div>
          ) : (
            <>
              {!emailMatches ? (
                <p role="alert" className={styles.safetyNote}>
                  This invite was sent to {invite.data.invite.inviteeEmail}, but you are signed in as{" "}
                  {signedInEmail || "an unknown account"}. Sign in with the invited address to accept.
                </p>
              ) : null}
              {error ? <p role="alert" className={styles.warning}>{error}</p> : null}
              <div className={styles.rowActions}>
                <Button
                  disabled={!invite.data.canAccept || respond.isPending}
                  onClick={() => void respondToInvite(true)}
                >
                  Accept invite
                </Button>
                <Button
                  variant="outline"
                  disabled={!emailMatches || respond.isPending}
                  onClick={() => void respondToInvite(false)}
                >
                  Decline
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
