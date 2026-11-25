"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { InAppReminders } from "@/components/today/in-app-reminders";
import { TodayHabitCard } from "@/components/today/today-habit-card";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPercent } from "@/domain/calculations";
import {
  addDays,
  localDateForInstant,
  scheduledOpportunitiesForRange,
} from "@/domain/schedule";
import type { HabitLog } from "@/domain/types";
import {
  useCreateException,
  useDeleteException,
  useDeleteLog,
  useHabits,
  useLogs,
  useUpsertLogs,
} from "@/lib/hooks/use-workspace";

export default function TodayPage() {
  const userId = useWorkspaceUserId();
  const { habits, schedules, exceptions, reminders, user } = useHabits(userId);
  const [manualDate, setManualDate] = useState<string | null>(null);

  // Account timezone decides which calendar day the list represents. Until
  // the profile loads, fall back to the browser's UTC calendar date.
  const timezone = user?.timezone;
  const accountToday = timezone
    ? localDateForInstant(new Date(), timezone, 0)
    : new Date().toISOString().slice(0, 10);
  const date = manualDate ?? accountToday;

  const month = date.slice(0, 7);
  const { logs } = useLogs(userId, month);
  const upsertLogs = useUpsertLogs(userId);
  const deleteLog = useDeleteLog(userId);
  const createException = useCreateException(userId);
  const deleteException = useDeleteException(userId);

  const items = habits
    .filter((habit) => habit.isActive)
    .map((habit) => {
      // Expand per habit so versioned cadences stay isolated.
      const opportunities = scheduledOpportunitiesForRange(
        schedules,
        exceptions,
        date,
        date,
        habit.id
      );
      const exception = exceptions.find(
        (item) => item.habitId === habit.id && item.startDate <= date && date <= item.endDate
      );
      const habitLogs = logs.filter((log) => log.habitId === habit.id && log.date === date);
      const schedule = schedules
        .filter((item) => item.habitId === habit.id && item.effectiveFrom <= date)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      const completed = opportunities.filter((opportunity) =>
        habitLogs.some(
          (log) =>
            (log.occurrence ?? 1) === opportunity.occurrence && (log.status ?? 0) >= 1
        )
      ).length;

      return {
        habit,
        opportunities,
        exception,
        habitLogs,
        schedule,
        completed,
        done: opportunities.length > 0 && completed === opportunities.length,
      };
    });

  const due = items.filter((item) => item.opportunities.length > 0 && !item.done);
  const complete = items.filter((item) => item.opportunities.length > 0 && item.done);
  const onBreak = items.filter((item) => item.exception);
  const unscheduled = items.filter((item) => !item.exception && item.opportunities.length === 0);

  const total = items.reduce((sum, item) => sum + item.opportunities.length, 0);
  const earned = items.reduce((sum, item) => sum + item.completed, 0);
  const progress = total ? earned / total : 0;

  const save = async (logsToSave: HabitLog[]): Promise<void> => {
    await upsertLogs.mutateAsync({ month, logs: logsToSave });
  };
  const undo = async (habitId: string, habitLogs: HabitLog[]): Promise<void> => {
    await Promise.all(
      habitLogs.map((log) =>
        deleteLog.mutateAsync({
          month,
          habitId,
          date: log.date,
          occurrence: log.occurrence ?? 1,
        })
      )
    );
  };

  const renderGroup = (
    title: string,
    description: string,
    group: typeof items
  ) =>
    group.length ? (
      <section className="space-y-3" aria-label={title}>
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ul className="space-y-2">
          {group.map((item) => (
            <TodayHabitCard
              key={item.habit.id}
              habit={item.habit}
              date={date}
              opportunities={item.opportunities}
              logs={item.habitLogs}
              schedule={item.schedule}
              exception={item.exception}
              onSave={save}
              onUndo={() => undo(item.habit.id, item.habitLogs)}
              onSkip={async () => {
                await createException.mutateAsync({
                  habitId: item.habit.id,
                  startDate: date,
                  endDate: date,
                  kind: "skip",
                  reason: "Skipped from Today",
                });
              }}
              onUnskip={
                item.exception
                  ? async () => {
                      await deleteException.mutateAsync(item.exception!.id);
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Today</h1>
          <p className="text-sm text-muted-foreground">
            Small steps count. Rest days count too.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setManualDate(addDays(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <time className="min-w-32 text-center text-sm font-semibold" dateTime={date}>
            {new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => setManualDate(addDays(date, 1))}
          >
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setManualDate(accountToday)}>
            Today
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="size-4 text-primary" /> Daily progress
          </CardTitle>
          <CardDescription>
            {total ? `${earned} of ${total} scheduled opportunities complete` : "Nothing scheduled for this day"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Daily completion progress"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {total === 0
              ? "An unscheduled day is not a missed day."
              : progress === 1
                ? "All done for today. Well earned."
                : `${formatPercent(progress)} complete — keep going at your own pace.`}
          </p>
        </CardContent>
      </Card>

      <InAppReminders
        habits={habits}
        reminders={reminders}
        user={user}
        date={date}
        logs={logs}
      />

      {renderGroup("Due today", "Your scheduled opportunities for this date.", due)}
      {renderGroup("Complete", "Already done. Nothing left to prove today.", complete)}
      {renderGroup("Rest & breaks", "Planned time off never counts as a miss.", onBreak)}
      {renderGroup("Not scheduled", "Not due today — no action needed.", unscheduled)}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <Link href="/app/grid" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          <CalendarDays className="size-3.5" /> Monthly grid
        </Link>
        <span>·</span>
        <Link href="/app/habits" className="font-semibold text-primary hover:underline">
          Manage habits
        </Link>
      </div>
    </div>
  );
}
