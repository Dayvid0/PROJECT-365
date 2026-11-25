"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { monthLabel, MonthNav } from "@/components/habits/month-nav";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPercent, toMonthString } from "@/domain/calculations";
import { apiFetch, errorMessage } from "@/lib/api";
import { useHabits, useSnapshot } from "@/lib/hooks/use-workspace";

export default function DashboardPage() {
  const userId = useWorkspaceUserId();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => toMonthString(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const { data: snapshot, isLoading, isError, refetch } = useSnapshot(userId, month);
  const { habits } = useHabits(userId);

  const refreshSnapshot = async () => {
    setRefreshing(true);
    try {
      await apiFetch(`/api/workspace/snapshots/${encodeURIComponent(month)}`, {
        method: "DELETE",
      });
      await refetch();
      toast.success("Dashboard refreshed");
    } catch (error) {
      toast.error("Could not refresh", { description: errorMessage(error) });
    } finally {
      setRefreshing(false);
      void queryClient.invalidateQueries();
    }
  };

  const weekly = snapshot
    ? [
        { label: "W1", value: +(snapshot.weeklyAverages.week1 * 100).toFixed(1) },
        { label: "W2", value: +(snapshot.weeklyAverages.week2 * 100).toFixed(1) },
        { label: "W3", value: +(snapshot.weeklyAverages.week3 * 100).toFixed(1) },
        { label: "W4", value: +(snapshot.weeklyAverages.week4 * 100).toFixed(1) },
      ]
    : [];

  const rate = snapshot?.completionRate ?? 0;
  const circumference = 2 * Math.PI * 66;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{monthLabel(month)} at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthNav month={month} onChange={setMonth} />
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Refresh snapshot"
            onClick={refreshSnapshot}
            disabled={refreshing}
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Could not load this month</CardTitle>
            <CardDescription>Check your connection and try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="h-64" />
        </Card>
      ) : (
        <>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-3 py-8">
              <svg viewBox="0 0 160 160" className="size-40" role="img" aria-label={`${formatPercent(rate)} monthly completion`}>
                <circle cx="80" cy="80" r="66" fill="none" stroke="var(--border)" strokeWidth="12" />
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${rate * circumference} ${circumference}`}
                  transform="rotate(-90 80 80)"
                />
                <text x="80" y="78" textAnchor="middle" className="fill-foreground text-3xl font-extrabold tabular">
                  {(rate * 100).toFixed(1)}
                </text>
                <text x="80" y="98" textAnchor="middle" className="fill-muted-foreground text-xs font-semibold">
                  % complete
                </text>
              </svg>
              <p className="text-sm font-medium text-muted-foreground">Monthly completion</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-[color-mix(in_srgb,#22C55E_50%,var(--border))] bg-card">
              <CardHeader className="pb-2">
                <CardDescription>🏆 Best habit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="truncate text-lg font-bold text-[color:var(--color-complete)]">
                  {snapshot?.bestHabit?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {snapshot?.bestHabit ? formatPercent(snapshot.bestHabit.score) : "No logs yet"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-[color-mix(in_srgb,#F59E0B_50%,var(--border))] bg-card">
              <CardHeader className="pb-2">
                <CardDescription>⚠️ Needs work</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="truncate text-lg font-bold text-[color:var(--color-partial)]">
                  {snapshot?.worstHabit?.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {snapshot?.worstHabit ? formatPercent(snapshot.worstHabit.score) : "No logs yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Weekly averages</CardTitle>
              <CardDescription>Based on days you actually logged.</CardDescription>
            </CardHeader>
            <CardContent>
              {weekly.some((item) => item.value > 0) ? (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={weekly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No data for this month yet.{" "}
                  <Link href="/app/grid" className="font-semibold text-primary hover:underline">
                    Fill in the grid
                  </Link>
                  .
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card py-4 text-center">
            <div>
              <p className="text-lg font-extrabold tabular text-[color:var(--color-complete)]">
                {formatPercent(snapshot?.completionRate ?? 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">Completion</p>
            </div>
            <div>
              <p className="text-lg font-extrabold tabular text-[color:var(--color-missed)]">
                {formatPercent(snapshot?.failureRate ?? 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">Failure rate</p>
            </div>
            <div>
              <p className="text-lg font-extrabold tabular text-primary">
                {habits.filter((habit) => habit.isActive).length}
              </p>
              <p className="text-[11px] text-muted-foreground">Active habits</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
