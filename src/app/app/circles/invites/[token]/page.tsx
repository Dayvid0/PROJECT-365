"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ShieldCheck, Users } from "lucide-react";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
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
import {
  useCircleInviteForViewer,
  useRespondToCircleInvite,
} from "@/lib/hooks/use-circles";

export default function CircleInviteReviewPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const invite = useCircleInviteForViewer(token, Boolean(token));
  const respond = useRespondToCircleInvite();

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
    return <p className="text-sm text-muted-foreground">Loading invite…</p>;
  }
  if (invite.isError || !invite.data) {
    return (
      <Card className="max-w-xl border-border bg-card">
        <CardHeader>
          <CardTitle>Invite unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This link is invalid, expired, or no longer available.
          </p>
          <Button variant="outline" asChild>
            <Link href="/app/circles">Back to circles</Link>
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
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Circle invite</h1>
        <p className="text-sm text-muted-foreground">
          Review this before you agree. Joining does not share any habit data.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> {invite.data.invite.circleName}
          </CardTitle>
          <CardDescription>
            Invited by {invite.data.invite.inviterName} for{" "}
            {invite.data.invite.inviteeEmail} · expires{" "}
            {new Date(invite.data.invite.expiresAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border px-3 py-2 text-sm">
            <p className="font-medium">What joining means</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              <li>
                You join a private group of {invite.data.memberCount} member
                {invite.data.memberCount === 1 ? "" : "s"}; no profile is published.
              </li>
              <li>You can leave at any time and revoke your own sharing.</li>
              <li>
                No habit, check-in, note, or history is visible to the group until you preview and
                confirm a separate share grant.
              </li>
            </ul>
          </div>
          {invite.data.circleDescription ? (
            <p className="text-sm text-muted-foreground">
              Purpose: {invite.data.circleDescription}
            </p>
          ) : null}

          {reply ? (
            <div className="space-y-3">
              <p className="text-sm">
                {reply === "accepted"
                  ? "You joined the circle. You can choose what, if anything, to share."
                  : "Invite declined. Nothing was shared."}
              </p>
              <Button asChild>
                <Link href="/app/circles">Go to circles</Link>
              </Button>
            </div>
          ) : (
            <>
              {!emailMatches ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive"
                >
                  This invite was sent to {invite.data.invite.inviteeEmail}, but you are signed in
                  as {signedInEmail || "an unknown account"}. Sign in with the invited address to
                  accept.
                </p>
              ) : null}
              {invite.data.alreadyMember ? (
                <p className="text-xs text-muted-foreground">You are already in this circle.</p>
              ) : null}
              {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!invite.data.canAccept || invite.data.alreadyMember || respond.isPending}
                  onClick={() => void respondToInvite(true)}
                >
                  <ShieldCheck className="size-4" /> Accept invite
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
