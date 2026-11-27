"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addDays, endOfMonth, format } from "date-fns";
import { ArrowLeft, Bell, CalendarRange, EyeOff, Flame, ShieldCheck } from "lucide-react";
import styles from "@/components/tracking/tracking.module.css";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import {
  formatPercent,
  getMonthDayGrid,
  habitCompletionRate,
  shiftMonth,
  streakSummary,
  toMonthString,
} from "@/domain/calculations";
import { scheduledDatesForRange } from "@/domain/schedule";
import type { HabitSchedule, HabitStatus } from "@/domain/types";
import type { HabitReminderInput } from "@/domain/validation";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { useAnalytics, useHabits, useUpsertReminder } from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<HabitStatus | "none", string | undefined> = {
  1: styles.gridDone,
  0.5: styles.gridPartial,
  0: styles.gridMissed,
  none: styles.gridNone,
};

function cadenceDescription(schedule: HabitSchedule | undefined): string {
  if (!schedule) return "No cadence version saved yet";
  const perDay = schedule.timesPerDay > 1 ? ` · ${schedule.timesPerDay}× a day` : "";
  switch (schedule.cadence) {
    case "daily":
      return `Every day${perDay}`;
    case "weekly":
      return schedule.weekdays.length
        ? `${schedule.weekdays.map((day) => WEEKDAY_LABELS[day] ?? day).join(", ")}${perDay}`
        : `${schedule.timesPerWeek ?? 0}× a week${perDay}`;
    case "interval":
      return `Every ${schedule.intervalDays ?? 1} days${perDay}`;
    case "monthly":
      return `On day ${schedule.monthDay ?? 1} of each month${perDay}`;
  }
}

const EMPTY_REMINDER: HabitReminderInput = {
  enabled: false,
  time: "08:00",
  weekdays: [],
  snoozeMinutes: 10,
  stopAfterCompletion: true,
};

export default function HabitDetailPage() {
  const params = useParams<{ habitId: string }>();
  const habitId = params.habitId;
  const userId = useWorkspaceUserId();
  const { habits, reminders, user } = useHabits(userId);
  const upsertReminder = useUpsertReminder(userId);
  const { data, isLoading } = useAnalytics(userId, 12);
  const [reminderDraft, setReminderDraft] = useState<HabitReminderInput | null>(null);

  const habit = habits.find((candidate) => candidate.id === habitId);
  const allLogs = (data?.logs ?? []).filter((log) => log.habitId === habitId);
  const schedules = data?.schedules ?? [];
  const exceptions = data?.exceptions ?? [];
  const logMap = new Map(allLogs.map((log) => [log.date, log.status]));
  const currentSchedule = schedules
    .filter((item) => item.habitId === habitId)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const upcomingDates = scheduledDatesForRange(
    schedules,
    exceptions,
    todayKey,
    format(addDays(new Date(), 13), "yyyy-MM-dd"),
    habitId
  );
  const activeBreaks = exceptions.filter(
    (item) => item.habitId === habitId && item.startDate <= todayKey && item.endDate >= todayKey
  ).length;

  const savedReminder = reminders.find((reminder) => reminder.habitId === habitId);
  const reminder = reminderDraft ?? savedReminder ?? EMPTY_REMINDER;

  const currentMonth = toMonthString(new Date());
  const previousMonth = shiftMonth(currentMonth, -1);
  const months = Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonth, index - 11));
  const breakdown = Array.from({ length: 6 }, (_, index) => shiftMonth(currentMonth, -index));
  const monthEnd = (month: string) =>
    format(endOfMonth(new Date(`${month}-01T00:00:00Z`)), "yyyy-MM-dd");
  const scheduledDatesForMonth = (month: string) =>
    scheduledDatesForRange(schedules, exceptions, `${month}-01`, monthEnd(month), habitId);

  const currentRate = habitCompletionRate(
    allLogs.filter((log) => log.date.startsWith(`${currentMonth}-`)),
    scheduledDatesForMonth(currentMonth)
  );
  const previousRate = habitCompletionRate(
    allLogs.filter((log) => log.date.startsWith(`${previousMonth}-`)),
    scheduledDatesForMonth(previousMonth)
  );
  const trend = currentRate - previousRate;
  const streakDates = scheduledDatesForRange(
    schedules,
    exceptions,
    `${months[0] ?? previousMonth}-01`,
    monthEnd(currentMonth),
    habitId
  );
  const streak = streakSummary(allLogs, streakDates, user?.streakPolicy ?? "strict");

  const toggleWeekday = (day: number) => {
    const weekdays = reminder.weekdays.includes(day)
      ? reminder.weekdays.filter((value) => value !== day)
      : [...reminder.weekdays, day].sort((a, b) => a - b);
    setReminderDraft({ ...reminder, weekdays });
  };

  const saveReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await upsertReminder.mutateAsync({ habitId, reminder });
      setReminderDraft(null);
    } catch {
      // Error toasts are handled by the mutation hook.
    }
  };

  if (!habit) {
    return (
      <Card className="mx-auto max-w-lg border-border bg-card">
        <CardHeader>
          <CardTitle>Habit not found</CardTitle>
          <CardDescription>It may have been removed or belongs to another account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/app/habits">Back to habits</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", styles.page)}>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/habits"><ArrowLeft className="size-4" /> Back to habits</Link>
      </Button>

      <Card className={cn("border-border bg-card", styles.stat)} style={{ borderTopColor: habit.color }}>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">{habit.category}</Badge>
            <span className="size-3 rounded-full" style={{ backgroundColor: habit.color }} />
          </div>
          <CardTitle className={styles.title}>{habit.name}</CardTitle>
          <CardDescription className={styles.subtitle}>Created {format(new Date(habit.createdAt), "MMM d, yyyy")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className={cn(styles.statValue, "text-primary")}>{formatPercent(currentRate)}</p>
            <p className={styles.statDetail}>This month</p>
          </div>
          <div>
            <p className={cn(styles.statValue, trend >= 0 ? "text-[color:var(--color-complete)]" : "text-[color:var(--color-partial)]")}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend * 100).toFixed(1)}%
            </p>
            <p className={styles.statDetail}>vs last month</p>
          </div>
          <div>
            {streak.visible ? (
              <p className={cn(styles.statValue, "flex items-center gap-1 text-[color:var(--color-partial)]")}>
                <Flame className="size-5" /> {streak.current}
                <span className="text-xs font-normal text-muted-foreground">best {streak.best}</span>
              </p>
            ) : (
              <p className={cn(styles.statValue, "flex items-center gap-1 text-muted-foreground")}>
                <EyeOff className="size-5" /> Hidden
              </p>
            )}
            <p className={styles.statDetail}>{streak.label}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", styles.panelTitle)}>
            <CalendarRange className="size-4 text-muted-foreground" /> Cadence
          </CardTitle>
          <CardDescription className={styles.panelDescription}>
            Derived from your saved schedule versions. Skips and planned breaks are excluded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold">{cadenceDescription(currentSchedule)}</p>
          <div className={styles.statGrid}>
            <div>
              <p className={styles.statLabel}>Next 14 days</p>
              <p className={cn(styles.statValue, "text-primary")}>{upcomingDates.length}</p>
              <p className={styles.statDetail}>scheduled opportunities</p>
            </div>
            <div>
              <p className={styles.statLabel}>Active breaks</p>
              <p className={cn(styles.statValue, "text-primary")}>{activeBreaks}</p>
              <p className={styles.statDetail}>skips or planned breaks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", styles.panelTitle)}>
            <Bell className="size-4 text-muted-foreground" /> Reminder
          </CardTitle>
          <CardDescription className={styles.panelDescription}>
            Preferences are saved here. The web app does not send push notifications; nudges appear
            on Today while a tab is open. Snooze and dismiss are available there for this visit only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveReminder} className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="reminder-enabled"><span className="text-sm">Reminder for this habit</span></Label>
              <Switch
                id="reminder-enabled"
                checked={reminder.enabled}
                onCheckedChange={(enabled) => setReminderDraft({ ...reminder, enabled })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reminder-time">Time</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  className="min-h-11"
                  value={reminder.time}
                  onChange={(event) => setReminderDraft({ ...reminder, time: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snooze-minutes">Snooze (minutes)</Label>
                <Input
                  id="snooze-minutes"
                  type="number"
                  min={0}
                  max={240}
                  className="min-h-11"
                  value={reminder.snoozeMinutes}
                  onChange={(event) =>
                    setReminderDraft({
                      ...reminder,
                      snoozeMinutes: Math.max(0, Math.min(240, Number(event.target.value) || 0)),
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Days (all days if none selected)</span>
              <div role="group" aria-label="Reminder days" className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={reminder.weekdays.includes(day)}
                    onClick={() => toggleWeekday(day)}
                    className={`tap-target rounded-full border px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      reminder.weekdays.includes(day)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4"
                checked={reminder.stopAfterCompletion}
                onChange={(event) =>
                  setReminderDraft({ ...reminder, stopAfterCompletion: event.target.checked })
                }
              />
              Stop nudging after this habit is complete
            </label>
            <Button type="submit" disabled={upsertReminder.isPending}>Save reminder</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className={styles.panelTitle}>12-month heatmap</CardTitle>
          <CardDescription className={styles.panelDescription}>Each square is one real day of history, derived from your saved logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {months.map((month) => (
              <div key={month} className="shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  {format(new Date(`${month}-01T00:00:00`), "MMM")}
                </p>
                <div className="grid grid-flow-col grid-rows-7 gap-[2px]">
                  {getMonthDayGrid(month).flat().map((day) => {
                    const date = format(day, "yyyy-MM-dd");
                    const status = logMap.get(date);
                    return (
                      <span
                        key={date}
                        className={cn("size-2 rounded-[2px]", STATUS_TONE[status ?? "none"])}
                        title={`${date}: ${status === undefined ? "no log" : status === 1 ? "done" : status === 0.5 ? "partial" : "missed"}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className={styles.panelTitle}>Monthly breakdown</CardTitle>
          <CardDescription className={styles.panelDescription}>Completion rate across the last six months.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading history…</p> : null}
          {breakdown.map((month) => {
            const rate = habitCompletionRate(
              allLogs.filter((log) => log.date.startsWith(`${month}-`)),
              scheduledDatesForMonth(month)
            );
            return (
              <div key={month} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(`${month}-01T00:00:00`), "MMM yyyy")}
                </span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${rate * 100}%`, backgroundColor: habit.color }} />
                </div>
                <span className="text-right text-xs font-semibold tabular">{formatPercent(rate)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className={styles.privacyNote}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span>
          <strong>Private by default.</strong> This history is yours alone unless you choose to
          share it in an invite-only Circle. Reminder preferences are honest in-app nudges, not
          push notifications.
        </span>
      </p>
    </div>
  );
}
