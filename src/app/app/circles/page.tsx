"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Copy, ShieldCheck, Users } from "lucide-react";
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
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Circles</h1>
        <p className="text-sm text-muted-foreground">
          Small, invite-only groups for compassionate accountability. Nothing is shared by joining.
        </p>
      </div>

      <Card className="border-primary/30 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-primary" /> Private by design
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Circles are never searchable or public. You invite people by their exact email address,
            they review what joining means before accepting, and every habit field still needs a
            separate preview and your explicit consent. There are no reactions, comments,
            leaderboards, or challenges here.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> Create a circle
          </CardTitle>
          <CardDescription>
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
        <Card className="border-primary/30 bg-card">
          <CardHeader>
            <CardTitle>Invites waiting for you</CardTitle>
            <CardDescription>Review the circle before you decide to join.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {received.data.invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{invite.circleName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      from {invite.inviterName} · expires {formatDate(invite.expiresAt)}
                    </span>
                  </span>
                  <span className="flex gap-2">
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

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Your circles</CardTitle>
          <CardDescription>
            Each circle has its own members and its own field-level grants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {circles.data?.circles.length ? (
            <ul className="space-y-2">
              {circles.data.circles.map((circle) => (
                <li key={circle.id}>
                  <Link
                    href={`/app/circles/${circle.id}`}
                    className="block rounded-md border border-border px-3 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{circle.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {circle.role} · {circle.memberCount} member
                        {circle.memberCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    {circle.description ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {circle.description}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No circles yet. Solo tracking works fully on its own.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
