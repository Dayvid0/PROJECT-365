"use client";

import { useState } from "react";
import Link from "next/link";
import { Grid3X3 } from "lucide-react";
import { HabitGridTable } from "@/components/habits/habit-grid-table";
import { MonthNav } from "@/components/habits/month-nav";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
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

const LEGEND = [
  { icon: "✔", label: "Done", color: "#22C55E" },
  { icon: "⚠", label: "Partial", color: "#F59E0B" },
  { icon: "✗", label: "Missed", color: "#EF4444" },
  { icon: "–", label: "No log", color: "#6B7280" },
] as const;

export default function GridPage() {
  const userId = useWorkspaceUserId();
  const [month, setMonth] = useState(() => toMonthString(new Date()));
  const { habits, isLoading, isError, refetch } = useHabits(userId);
  const { logs, isError: logsError, refetch: refetchLogs } = useLogs(userId, month);
  const upsertLogs = useUpsertLogs(userId);

  const activeHabits = habits.filter((habit) => habit.isActive);

  const handleCellTap = (habitId: string, date: string, status: HabitStatus) => {
    upsertLogs.mutate({
      month,
      logs: [{ habitId, date, status, updatedAt: new Date().toISOString() }],
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Habit grid</h1>
          <p className="text-sm text-muted-foreground">
            Tap a cell to cycle: done → partial → missed → done.
          </p>
        </div>
        <MonthNav month={month} onChange={setMonth} />
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
      ) : (
        <>
          <HabitGridTable month={month} habits={activeHabits} logs={logs} onCellTap={handleCellTap} />
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            {LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span className="text-base font-bold" style={{ color: item.color }}>{item.icon}</span>
                {item.label}
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Changes are saved immediately. If you&apos;re offline, they queue and sync on reconnect.
          </p>
        </>
      )}
    </div>
  );
}
