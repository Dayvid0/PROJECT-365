"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Sun,
} from "lucide-react";
import { InAppReminders } from "@/components/today/in-app-reminders";
import { TodayHabitCard } from "@/components/today/today-habit-card";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { Button } from "@/components/ui/button";
import { dedupeLogs, formatPercent } from "@/domain/calculations";
import {
  addDays,
  localDateForInstant,
  scheduledOpportunitiesForRange,
  weekdayOf,
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
import { cn } from "@/lib/utils";
import styles from "./today.module.css";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

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
  const { logs, isLoading: monthLoading } = useLogs(userId, month);
  const weekStart = addDays(date, -((weekdayOf(date) + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const adjacentMonth = weekEnd.slice(0, 7) === month ? null : weekEnd.slice(0, 7);
  const { logs: adjacentLogs, isLoading: adjacentLoading } = useLogs(
    userId,
    adjacentMonth ?? month
  );
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

  // Week dots are derived from saved logs only; a rest day is never a miss.
  // A Monday–Sunday week can cross a month boundary, so the adjacent month's
  // logs are read from the same query cache the check-in controls write to.
  const weekLogs = adjacentMonth ? dedupeLogs([...logs, ...adjacentLogs]) : logs;
  const weekLoading = monthLoading || (adjacentMonth ? adjacentLoading : false);
  const activeHabits = habits.filter((habit) => habit.isActive);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const opportunities = activeHabits.flatMap((habit) =>
      scheduledOpportunitiesForRange(schedules, exceptions, day, day, habit.id)
    );
    const dayLogs = weekLogs.filter((log) => log.date === day);
    const completed = opportunities.filter((opportunity) =>
      dayLogs.some(
        (log) =>
          log.habitId === opportunity.habitId &&
          (log.occurrence ?? 1) === opportunity.occurrence &&
          (log.status ?? 0) >= 1
      )
    ).length;
    const logged = opportunities.filter((opportunity) =>
      dayLogs.some(
        (log) =>
          log.habitId === opportunity.habitId &&
          (log.occurrence ?? 1) === opportunity.occurrence &&
          (log.status ?? 0) > 0
      )
    ).length;
    const resting = exceptions.some(
      (item) => item.startDate <= day && day <= item.endDate
    );
    const dayLabel = new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const detail = weekLoading
      ? "Loading check-ins"
      : opportunities.length === 0
        ? resting
          ? "Planned break"
          : "Nothing scheduled"
        : completed === opportunities.length
          ? `${completed} of ${opportunities.length} opportunities complete`
          : logged > 0
            ? `Progress saved on ${logged} of ${opportunities.length} opportunities`
            : "Not logged yet";

    return {
      day,
      label: `${dayLabel} — ${detail}`,
      complete: !weekLoading && opportunities.length > 0 && completed === opportunities.length,
      partial: !weekLoading && logged > 0 && completed < opportunities.length,
      rest: !weekLoading && resting && opportunities.length === 0,
      today: day === date,
    };
  });

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
      <section className={styles.group} aria-label={title}>
        <div className={styles.groupHead}>
          <div>
            <h2 className={styles.groupTitle}>{title}</h2>
            <p className={styles.groupDescription}>{description}</p>
          </div>
        </div>
        <ul className={styles.habitList}>
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
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <span className={styles.eyebrow}>YOUR PRACTICE</span>
          <h1 className={styles.title}>Today</h1>
          <p className={styles.subtitle}>Small steps count. Rest days count too.</p>
        </div>
        <div className={styles.dayNav}>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setManualDate(addDays(date, -1))}
          >
            <ChevronLeft />
          </Button>
          <time className={styles.dayTime} dateTime={date}>
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

      <section className={styles.thought} aria-label="A thought to begin">
        <div className={styles.thoughtCopy}>
          <span className={styles.eyebrow}>A THOUGHT TO BEGIN</span>
          <blockquote className={styles.quote}>
            “Small steps, kept with care, become a rhythm.”
          </blockquote>
          <span className={styles.quoteCredit}>Daymark · a thought for today</span>
        </div>
        <span className={styles.sunmark} aria-hidden="true">
          <Sun className="size-6" />
        </span>
      </section>

      <div className={styles.progress}>
        <div className={styles.progressMeta}>
          <span className={styles.eyebrow}>YOUR COMMITMENTS</span>
          <strong className={styles.progressCount}>
            {total} <small>scheduled opportunities</small>
          </strong>
        </div>
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Daily completion progress"
        >
          <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={styles.progressValue} aria-hidden="true">
          {formatPercent(progress)}
        </span>
        <p className={styles.progressNote}>
          {total
            ? `${earned} of ${total} scheduled opportunities complete`
            : "Nothing scheduled for this day"}
        </p>
      </div>

      <div className={styles.gentleNote}>
        <Heart className="size-4" aria-hidden="true" />
        <span>
          Rest days count too. Missed one? Your progress stays — start with one small step.
        </span>
      </div>

      <div className={styles.reminders}>
        <InAppReminders
          habits={habits}
          reminders={reminders}
          user={user}
          date={date}
          logs={logs}
        />
      </div>

      {renderGroup("Due today", "Your scheduled opportunities for this date.", due)}
      {renderGroup("Complete", "Already done. Nothing left to prove today.", complete)}
      {renderGroup("Rest & breaks", "Planned time off never counts as a miss.", onBreak)}
      {renderGroup("Not scheduled", "Not due today — no action needed.", unscheduled)}

      <div className={styles.bottomGrid}>
        <section className={styles.miniCard} aria-label="This week">
          <span className={styles.eyebrow}>THIS WEEK</span>
          <div className={styles.weekDots}>
            {week.map((item, index) => (
              <div key={item.day} className={styles.weekDay}>
                <span
                  role="img"
                  aria-label={item.label}
                  className={cn(
                    styles.weekDot,
                    item.complete && styles.weekDone,
                    item.partial && styles.weekPartial,
                    item.rest && styles.weekRest,
                    item.today && styles.weekToday
                  )}
                >
                  {item.complete ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : item.today ? (
                    <span className={styles.weekTodayDot} aria-hidden="true" />
                  ) : null}
                </span>
                <small aria-hidden="true">{WEEKDAYS[index]}</small>
              </div>
            ))}
          </div>
          <small className={styles.weekCaption}>A rhythm, not a streak.</small>
        </section>
        <aside className={styles.quoteCard}>
          <Sparkles className="size-4" aria-hidden="true" />
          <span>Small actions, repeated with care.</span>
          <small>Keep your word. Keep your pace.</small>
        </aside>
      </div>

      <div className={styles.footerLinks}>
        <Link href="/app/grid">
          <CalendarDays className="size-3.5" /> Monthly grid
        </Link>
        <span>·</span>
        <Link href="/app/habits">Manage habits</Link>
      </div>
    </div>
  );
}
