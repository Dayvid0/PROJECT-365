"use client";

import { useState } from "react";
import { Flag, Trash2 } from "lucide-react";
import type { CircleReactionKind, CircleSharedUpdate } from "@/domain/types";
import { CIRCLE_REACTION_KINDS } from "@/lib/constants";
import {
  useCreateCircleComment,
  useDeleteCircleComment,
  useSetCircleReaction,
} from "@/lib/hooks/use-circles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const REACTION_LABELS: Record<CircleReactionKind, string> = {
  cheer: "Cheer",
  support: "Support",
  respect: "Respect",
};

interface ReportRequest {
  targetId: string;
  targetUserId: string;
  detail: string;
}

interface CircleSupportPanelProps {
  userId: string;
  circleId: string;
  update: CircleSharedUpdate;
  onReport: (request: ReportRequest) => void;
}

export function CircleSupportPanel({
  userId,
  circleId,
  update,
  onReport,
}: CircleSupportPanelProps) {
  const [draft, setDraft] = useState("");
  const grantId = update.preview.grantId;
  const reactions = update.interactions.reactions;
  const setReaction = useSetCircleReaction(userId, circleId);
  const addComment = useCreateCircleComment(userId, circleId);
  const deleteComment = useDeleteCircleComment(userId, circleId);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    try {
      await addComment.mutateAsync({ grantId, body });
      setDraft("");
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div>
        <p className="text-xs font-medium">Send support</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CIRCLE_REACTION_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={reactions.viewerReaction === kind ? "secondary" : "outline"}
              disabled={setReaction.isPending}
              aria-pressed={reactions.viewerReaction === kind}
              onClick={() => setReaction.mutate({ grantId, kind })}
            >
              {REACTION_LABELS[kind]} · {reactions.counts[kind]}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Counts are anonymous. Tap again to remove your reaction.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => void submit(event)}>
        <Input
          aria-label={`Reply to ${update.ownerName}`}
          className="min-w-56 flex-1"
          maxLength={1000}
          value={draft}
          placeholder="Write a kind reply"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || addComment.isPending}>
          Reply
        </Button>
      </form>

      {update.interactions.comments.length ? (
        <ul className="space-y-2">
          {update.interactions.comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{comment.authorName}</span>
                <span className="flex items-center gap-1">
                  {comment.canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteComment.isPending}
                      aria-label={`Delete comment from ${comment.authorName}`}
                      onClick={() => deleteComment.mutate({ grantId, commentId: comment.id })}
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  ) : null}
                  {comment.authorId === userId ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Report comment from ${comment.authorName}`}
                      onClick={() =>
                        onReport({
                          targetId: comment.id,
                          targetUserId: comment.authorId,
                          detail: `Comment from ${comment.authorName}`,
                        })
                      }
                    >
                      <Flag className="size-3.5" /> Report
                    </Button>
                  )}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
