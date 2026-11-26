"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LockKeyhole, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatPercent } from "@/domain/calculations";
import { shiftWeekStart, weekEndFor, weekStartFor } from "@/domain/weekly-review";
import { errorMessage } from "@/lib/api";
import {
  useSaveWeeklyNote,
  useWeeklyReview,
} from "@/lib/hooks/use-weekly-review";
import { cn } from "@/lib/utils";

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function deltaLabel(delta: number | null): string {
  if (delta === null) return "No prior schedule to compare";
  const rounded = Math.round(delta);
  if (rounded === 0) return "Same as last week";
  return `${rounded > 0 ? "+" : ""}${rounded} pts vs last week`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular">{value}</div>
    </div>
  );
}

export function WeeklyReviewPanel({ userId }: { userId: string }) {
  const [currentWeekStart] = useState(() =>
    weekStartFor(new Date().toISOString().slice(0, 10))
  );
  const [week, setWeek] = useState(currentWeekStart);
  const [draftState, setDraftState] = useState({ week: "", note: "" });
  const { data, isLoading, isError } = useWeeklyReview(userId, week);
  const saveNote = useSaveWeeklyNote(userId);
  const review = data?.review;
  const storedNote = review?.note ?? "";
  const note = draftState.week === week ? draftState.note : storedNote;

  const earliestWeek = shiftWeekStart(currentWeekStart, -52);
  const canGoBack = week > earliestWeek;
  const canGoForward = week < currentWeekStart;

  const save = async () => {
    try {
      await saveNote.mutateAsync({ week, note });
    } catch (error) {
      toast.error("Could not save reflection", { description: errorMessage(error) });
    }
  };

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Weekly review
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {shortDate(week)} – {shortDate(weekEndFor(week))}
            </span>
            <span aria-hidden="true">·</span>
            <span>Compared with your own previous week</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <LockKeyhole className="size-3" /> Private
            </span>
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            disabled={!canGoBack}
            onClick={() => setWeek((value) => shiftWeekStart(value, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            disabled={!canGoForward}
            onClick={() => setWeek((value) => shiftWeekStart(value, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {isError ? (
          <p className="text-sm text-destructive">Could not load this weekly review.</p>
        ) : isLoading || !review ? (
          <div className="h-32 animate-pulse rounded-lg bg-muted" />
        ) : (
          <>
            <div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Metric label="Completion" value={formatPercent(review.current.completionRate)} />
                <Metric label="Done" value={String(review.current.completed)} />
                <Metric label="Partial" value={String(review.current.partial)} />
                <Metric label="Not checked in" value={String(review.current.missed)} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {review.current.scheduled} scheduled opportunities after skips and planned breaks.
                <span
                  className={cn(
                    "ml-2 font-semibold",
                    review.delta === null
                      ? "text-muted-foreground"
                      : review.delta >= 0
                        ? "text-[var(--color-complete)]"
                        : "text-[var(--color-partial)]"
                  )}
                >
                  {deltaLabel(review.delta)}
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">By habit</h3>
              {review.habits.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No scheduled habits in this week. Nothing to catch up on.
                </p>
              ) : (
                <ul className="space-y-2">
                  {review.habits.map((habit) => (
                    <li
                      key={habit.habitId}
                      className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-3 rounded-md border border-border px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: habit.color }}
                        />
                        <span className="truncate">{habit.name}</span>
                      </span>
                      <span className="hidden text-right text-xs tabular sm:block">
                        {deltaLabel(habit.delta)}
                      </span>
                      <span className="text-right text-sm font-semibold tabular">
                        {formatPercent(habit.current.completionRate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Context from check-ins</h3>
              {review.contextNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No notes attached this week.</p>
              ) : (
                <ul className="space-y-2">
                  {review.contextNotes.map((note) => (
                    <li
                      key={`${note.habitId}-${note.date}`}
                      className="rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <span className="font-medium">
                        {note.habitName ?? "Archived habit"} · {shortDate(note.date)}
                      </span>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{note.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="weekly-reflection">Private reflection</Label>
              <textarea
                id="weekly-reflection"
                value={note}
                maxLength={2000}
                rows={3}
                placeholder="What helped this week? What would make next week easier?"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setDraftState({ week, note: event.target.value })}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Only you can see this. It is never included in a share grant.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saveNote.isPending || note === storedNote}
                  onClick={() => void save()}
                >
                  Save reflection
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
