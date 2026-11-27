"use client";

import { useState } from "react";
import Link from "next/link";
import { Grid3X3, ShieldCheck } from "lucide-react";
import { HabitGridTable } from "@/components/habits/habit-grid-table";
import { MonthNav } from "@/components/habits/month-nav";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import styles from "@/components/tracking/tracking.module.css";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toMonthString } from "@/domain/calculations";
import type { HabitStatus } from "@/domain/types";
import { useHabits, useLogs, useUpsertLogs } from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils";

const LEGEND = [
  { icon: "✔", label: "Done", tone: styles.swatchDone },
  { icon: "◐", label: "Partial", tone: styles.swatchPartial },
  { icon: "✗", label: "Missed", tone: styles.swatchMissed },
  { icon: "⚠", label: "Excused — not counted", tone: styles.swatchExcused },
  { icon: "–", label: "No log", tone: styles.swatchNone },
] as const;

export default function GridPage() {
  const userId = useWorkspaceUserId();
  const [month, setMonth] = useState(() => toMonthString(new Date()));
  const { habits, schedules, exceptions, isLoading, isError, refetch } = useHabits(userId);
  const { logs, isError: logsError, refetch: refetchLogs } = useLogs(userId, month);
  const upsertLogs = useUpsertLogs(userId);

  const activeHabits = habits.filter((habit) => habit.isActive);
  const monthHabits = activeHabits.filter((habit) =>
    schedules.some(
      (schedule) =>
        schedule.habitId === habit.id &&
        schedule.effectiveFrom <= `${month}-31` &&
        (!schedule.effectiveTo || schedule.effectiveTo >= `${month}-01`)
    ) || logs.some((log) => log.habitId === habit.id && log.date.startsWith(`${month}-`))
  );

  const handleCellTap = (habitId: string, date: string, status: HabitStatus) => {
    upsertLogs.mutate({
      month,
      logs: [{ habitId, date, status, updatedAt: new Date().toISOString() }],
    });
  };

  return (
    <div className={cn("space-y-5", styles.page)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", styles.pageHead)}>
        <div>
          <span className={styles.eyebrow}>MONTH BY MONTH · YOUR GRID</span>
          <h1 className={styles.title}>Habit grid</h1>
          <p className={styles.subtitle}>
            Every square is a real day; filled squares come from saved check-ins. Tap a cell to
            cycle: done → partial → missed → done. Excused days marked ⚠ are outside your control
            and are not counted.
          </p>
        </div>
        <div className={styles.actions}>
          <MonthNav month={month} onChange={setMonth} />
        </div>
      </div>

      {isError || logsError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load the grid</CardTitle>
            <CardDescription>Your connection may be unavailable.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => void refetch()}>Retry habits</Button>
            <Button variant="outline" onClick={() => void refetchLogs()}>Retry logs</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="animate-pulse"><CardContent className="h-96" /></Card>
      ) : activeHabits.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="items-center text-center">
            <Grid3X3 className="size-10 text-muted-foreground" />
            <CardTitle>No habits to track</CardTitle>
            <CardDescription>Add your first habit to start filling in the grid.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/app/habits">+ Add your first habit</Link>
            </Button>
          </CardContent>
        </Card>
      ) : monthHabits.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="items-center text-center">
            <Grid3X3 className="size-10 text-muted-foreground" />
            <CardTitle>No habits tracked in this month</CardTitle>
            <CardDescription>Switch months to review your imported history.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <HabitGridTable
            month={month}
            habits={monthHabits}
            logs={logs}
            schedules={schedules}
            exceptions={exceptions}
            onCellTap={handleCellTap}
          />
          <div className={styles.legend} aria-label="Grid legend">
            {LEGEND.map((item) => (
              <span key={item.label} className={styles.legendItem}>
                <span className={cn(styles.swatch, item.tone)} aria-hidden="true">{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Changes are saved immediately. If you&apos;re offline, they queue and sync on reconnect.
          </p>
          <p className={styles.privacyNote}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>
              <strong>Private by default.</strong> Your grid is derived from your own check-ins
              and is never shown to other people unless you invite them to a Circle.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
