"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, ShieldCheck, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCircles,
  useCreateCircle,
  useReceivedCircleInvites,
} from "@/lib/hooks/use-circles";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CirclesPage() {
  const userId = useWorkspaceUserId();
  const circles = useCircles(userId);
  const received = useReceivedCircleInvites(userId);
  const createCircle = useCreateCircle(userId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await createCircle.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
      });
      setName("");
      setDescription("");
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/app/circles/invites/${token}`
      );
      toast.success("Circle invite link copied");
    } catch {
      toast.error("Could not copy link", { description: "Open the invite to copy it instead." });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>SMALL, INTENTIONAL CIRCLES</span>
          <h1 className={styles.title}>Circles</h1>
          <p className={styles.subtitle}>
            Small, invite-only groups for compassionate accountability. Nothing is shared by joining.
          </p>
        </div>
      </div>

      <Card className={styles.panelAccent}>
        <CardHeader className="pb-2">
          <CardTitle className={styles.subsectionTitle}>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Private by design
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={styles.panelDescription}>
            Circles are never searchable or public. You invite people by their exact email address,
            they review what joining means before accepting, and every habit field still needs a
            separate preview and your explicit consent. Supportive reactions, replies, and private
            challenges stay inside the circle. Public challenge discovery is a separate,
            moderation-gated area; circles never feed into it. There is no direct messaging or
            leaderboard.
          </p>
        </CardContent>
      </Card>

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>
            <span className="flex items-center gap-2">
              <Users className="size-4 text-primary" /> Create a circle
            </span>
          </CardTitle>
          <CardDescription className={styles.panelDescription}>
            You become the owner. Only invited members can see that the circle exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => void create(event)}>
            <div className="space-y-2">
              <Label htmlFor="circle-name">Circle name</Label>
              <Input
                id="circle-name"
                required
                maxLength={80}
                value={name}
                placeholder="Morning walk crew"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="circle-description">Purpose (optional)</Label>
              <Input
                id="circle-description"
                maxLength={500}
                value={description}
                placeholder="A small group for steady, kind check-ins"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!name.trim() || createCircle.isPending}>
              Create circle
            </Button>
          </form>
        </CardContent>
      </Card>

      {received.data?.invites.length ? (
        <Card className={styles.panelAccent}>
          <CardHeader>
            <CardTitle className={styles.panelTitle}>Invites waiting for you</CardTitle>
            <CardDescription className={styles.panelDescription}>
              Review the circle before you decide to join.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className={styles.rowList}>
              {received.data.invites.map((invite) => (
                <li key={invite.id} className={styles.row}>
                  <span>
                    <span className="font-medium">{invite.circleName}</span>
                    <span className={styles.rowMeta}>
                      from {invite.inviterName} · expires {formatDate(invite.expiresAt)}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyLink(invite.token)}
                    >
                      <Copy className="size-3.5" /> Copy link
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/circles/invites/${invite.token}`}>Review invite</Link>
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className={styles.panel}>
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Your circles</CardTitle>
          <CardDescription className={styles.panelDescription}>
            Each circle has its own members and its own field-level grants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {circles.data?.circles.length ? (
            <ul className={styles.rowList}>
              {circles.data.circles.map((circle) => (
                <li key={circle.id}>
                  <Link
                    href={`/app/circles/${circle.id}`}
                    className={`${styles.row} block transition-colors hover:bg-muted`}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{circle.name}</span>
                      <span className={styles.rowMeta}>
                        {circle.role} · {circle.memberCount} member
                        {circle.memberCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    {circle.description ? (
                      <span className={`${styles.rowMeta} mt-1 block`}>
                        {circle.description}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No circles yet. Solo tracking works fully on its own.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
