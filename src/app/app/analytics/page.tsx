"use client";

import { useState } from "react";
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { WeeklyReviewPanel } from "@/components/analytics/weekly-review-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { dailyScore, formatPercent, habitCompletionRate, shiftMonth, toMonthString } from "@/domain/calculations";
import { scheduledDatesForRange } from "@/domain/schedule";
import { useAnalytics, useHabits } from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils";

type ViewMode = "weekly" | "monthly" | "yearly";
const MODES: ViewMode[] = ["weekly", "monthly", "yearly"];

export default function AnalyticsPage() {
  const userId = useWorkspaceUserId();
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const { data, isLoading, isError } = useAnalytics(userId, 12);
  const { habits } = useHabits(userId);

  const allLogs = data?.logs ?? [];
  const schedules = data?.schedules ?? [];
  const exceptions = data?.exceptions ?? [];
  const activeHabits = habits.filter((habit) => habit.isActive);
  const currentMonth = toMonthString(new Date());
  const rangeStart = data?.months[0] ? `${data.months[0]}-01` : `${currentMonth}-01`;
  const rangeEndMonth = data?.months[data.months.length - 1] ?? currentMonth;
  const rangeEnd = format(
    endOfMonth(new Date(`${rangeEndMonth}-01T00:00:00Z`)),
    "yyyy-MM-dd"
  );

  const rateForHabit = (habitId: string, logs = allLogs) =>
    habitCompletionRate(
      logs.filter((log) => log.habitId === habitId),
      scheduledDatesForRange(schedules, exceptions, rangeStart, rangeEnd, habitId)
    );

  const lineData = (() => {
    if (viewMode === "weekly") {
      const today = new Date();
      return eachDayOfInterval({ start: subDays(today, 6), end: today }).map((day) => {
        const date = format(day, "yyyy-MM-dd");
        const score = dailyScore(allLogs.filter((log) => log.date === date));
        return { label: format(day, "EEE"), value: +(score * 100).toFixed(1) };
      });
    }
    if (viewMode === "monthly") {
      const today = new Date();
      return eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) }).map((day) => {
        const date = format(day, "yyyy-MM-dd");
        const score = dailyScore(allLogs.filter((log) => log.date === date));
        return { label: format(day, "d"), value: +(score * 100).toFixed(1) };
      });
    }
    return Array.from({ length: 12 }, (_, index) => {
      const month = shiftMonth(currentMonth, index - 11);
      const logs = allLogs.filter((log) => log.date.startsWith(`${month}-`));
      const score = dailyScore(logs);
      return { label: format(new Date(`${month}-01T00:00:00`), "MMM"), value: +(score * 100).toFixed(1) };
    });
  })();

  const habitData = activeHabits.slice(0, 8).map((habit) => ({
    label: habit.name.slice(0, 10),
    value: +(rateForHabit(habit.id) * 100).toFixed(1),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Trends across scheduled opportunities, not just logged days.</p>
        </div>
        <div className="flex rounded-md border border-border bg-muted p-1">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-semibold capitalize",
                viewMode === mode ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <WeeklyReviewPanel userId={userId} />

      {isError ? (
        <Card className="border-destructive/40">
          <CardHeader><CardTitle>Could not load analytics</CardTitle></CardHeader>
        </Card>
      ) : isLoading ? (
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      ) : activeHabits.length === 0 || allLogs.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="items-center text-center">
            <BarChart3 className="size-10 text-muted-foreground" />
            <CardTitle>Nothing to chart yet</CardTitle>
            <CardDescription>Log a few days in the grid and come back for trends.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Daily scores</CardTitle>
              <CardDescription>One point per logged habit day; partial counts as half.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={lineData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Habit performance</CardTitle>
              <CardDescription>Completion rate for your top eight habits.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={habitData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Overall stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeHabits.map((habit) => {
                const rate = rateForHabit(habit.id);
                const color = rate >= 0.7 ? "var(--color-complete)" : rate >= 0.4 ? "var(--color-partial)" : "var(--color-missed)";
                return (
                  <div key={habit.id} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                      <span className="truncate">{habit.name}</span>
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${rate * 100}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-right text-xs font-semibold tabular">{formatPercent(rate)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
