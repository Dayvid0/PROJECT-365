"use client";

import { Flag, Heart, Trash2 } from "lucide-react";
import styles from "@/components/trust/trust.module.css";
import type { CircleReactionKind, CircleReceivedSupport } from "@/domain/types";
import { CIRCLE_REACTION_KINDS } from "@/lib/constants";
import { useDeleteCircleComment } from "@/lib/hooks/use-circles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

interface CircleReceivedSupportPanelProps {
  userId: string;
  circleId: string;
  support: CircleReceivedSupport[];
  onReport: (request: ReportRequest) => void;
}

/** The grant owner can read support on their own update but cannot react to themselves. */
export function CircleReceivedSupportPanel({
  userId,
  circleId,
  support,
  onReport,
}: CircleReceivedSupportPanelProps) {
  const deleteComment = useDeleteCircleComment(userId, circleId);

  return (
    <Card className={styles.panel}>
      <CardHeader>
        <CardTitle className={styles.panelTitle}>
          <span className="flex items-center gap-2">
            <Heart className="size-4 text-primary" /> Support you have received
          </span>
        </CardTitle>
        <CardDescription className={styles.panelDescription}>
          Anonymous counts and kind replies from current circle members on updates you chose to
          share. Block and mute boundaries hide support in both directions.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.rowList}>
        {support.map((item) => (
          <div key={item.grantId} className={`${styles.row} flex-col items-stretch`}>
            <p className={styles.rowTitle}>{item.label}</p>
            <p className={`${styles.rowMeta} mt-1`}>
              {CIRCLE_REACTION_KINDS.map(
                (kind) => `${REACTION_LABELS[kind]} ${item.interactions.reactions.counts[kind]}`
              ).join(" · ")}
            </p>
            {item.interactions.comments.length ? (
              <ul className={`${styles.rowList} mt-2`}>
                {item.interactions.comments.map((comment) => (
                  <li key={comment.id} className={`${styles.row} flex-col items-stretch text-xs`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={styles.rowTitle}>{comment.authorName}</span>
                      <span className={styles.rowActions}>
                        {comment.canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deleteComment.isPending}
                            aria-label={`Delete comment from ${comment.authorName}`}
                            onClick={() =>
                              deleteComment.mutate({
                                grantId: item.grantId,
                                commentId: comment.id,
                              })
                            }
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
                    <p className={`${styles.previewValue} mt-1`}>{comment.body}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
