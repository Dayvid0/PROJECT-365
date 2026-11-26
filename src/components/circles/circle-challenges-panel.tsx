"use client";

import { useState } from "react";
import { Flag, Sparkles, Trash2 } from "lucide-react";
import {
  useCircleChallenges,
  useCreateCircleChallenge,
  useDeleteCircleChallenge,
  useSetCircleChallengeParticipation,
} from "@/lib/hooks/use-circles";
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

interface ReportRequest {
  targetId: string;
  targetUserId: string;
  detail: string;
}

interface CircleChallengesPanelProps {
  userId: string;
  circleId: string;
  onReport: (request: ReportRequest) => void;
}

export function CircleChallengesPanel({
  userId,
  circleId,
  onReport,
}: CircleChallengesPanelProps) {
  const challenges = useCircleChallenges(userId, circleId);
  const create = useCreateCircleChallenge(userId, circleId);
  const participation = useSetCircleChallengeParticipation(userId, circleId);
  const remove = useDeleteCircleChallenge(userId, circleId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    try {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        startsAt: new Date(`${startDate}T00:00:00`).toISOString(),
        endsAt: new Date(`${endDate}T23:59:59`).toISOString(),
      });
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Private challenges
        </CardTitle>
        <CardDescription>
          Intentions shared only with current circle members. Joining records participation, not
          progress. There is no ranking or public discovery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <div className="space-y-2">
            <Label htmlFor="challenge-title">Challenge</Label>
            <Input
              id="challenge-title"
              maxLength={80}
              required
              value={title}
              placeholder="Ten quiet minutes each day"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenge-description">Why it matters (optional)</Label>
            <Input
              id="challenge-description"
              maxLength={500}
              value={description}
              placeholder="A kind intention, not a score"
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenge-start">Starts</Label>
            <Input
              id="challenge-start"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="challenge-end">Ends</Label>
            <Input
              id="challenge-end"
              type="date"
              required
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              Create private challenge
            </Button>
          </div>
        </form>

        {challenges.data?.challenges.length ? (
          <ul className="space-y-2">
            {challenges.data.challenges.map((challenge) => (
              <li
                key={challenge.id}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{challenge.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {challenge.creatorName} ·{" "}
                      {new Date(challenge.startsAt).toLocaleDateString()} –{" "}
                      {new Date(challenge.endsAt).toLocaleDateString()}
                    </p>
                    {challenge.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{challenge.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {challenge.participantCount} joined · no names or progress shown
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
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
                    {challenge.canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={remove.isPending}
                        aria-label={`Delete challenge ${challenge.title}`}
                        onClick={() => remove.mutate(challenge.id)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    ) : null}
                    {challenge.creatorId === userId ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Report challenge ${challenge.title}`}
                        onClick={() =>
                          onReport({
                            targetId: challenge.id,
                            targetUserId: challenge.creatorId,
                            detail: `Challenge: ${challenge.title}`,
                          })
                        }
                      >
                        <Flag className="size-3.5" /> Report
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No private challenges yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
