"use client";

import { format } from "date-fns";
import Link from "next/link";
import {
  cycleStatus,
  dailyScore,
  getMonthDayGrid,
  habitCompletionRate,
  logKey,
} from "@/domain/calculations";
import { scheduledDatesForRange } from "@/domain/schedule";
import type {
  Habit,
  HabitLog,
  HabitSchedule,
  HabitStatus,
  ScheduleException,
} from "@/domain/types";
import styles from "@/components/tracking/tracking.module.css";
import { cn } from "@/lib/utils";

function statusIcon(status: HabitStatus | undefined): string {
  if (status === 1) return "✔";
  if (status === 0.5) return "⚠";
  if (status === 0) return "✗";
  return "–";
}

function statusTone(status: HabitStatus | undefined): string | undefined {
  if (status === 1) return styles.gridDone;
  if (status === 0.5) return styles.gridPartial;
  if (status === 0) return styles.gridMissed;
  return styles.gridNone;
}

function rateTone(rate: number | null): string | undefined {
  if (rate === null) return styles.gridNone;
  if (rate >= 0.7) return styles.gridDone;
  if (rate >= 0.4) return styles.gridPartial;
  return styles.gridMissed;
}

/** The original 4-week / 31-day tapping grid, adapted to responsive web. */
export function HabitGridTable({
  month,
  habits,
  logs,
  schedules,
  exceptions,
  onCellTap,
}: {
  month: string;
  habits: Habit[];
  logs: HabitLog[];
  schedules: HabitSchedule[];
  exceptions: ScheduleException[];
  onCellTap: (habitId: string, date: string, next: HabitStatus) => void;
}) {
  const weeks = getMonthDayGrid(month);
  const monthDays = weeks.flat().map((day) => format(day, "yyyy-MM-dd"));
  const monthStart = monthDays[0] ?? `${month}-01`;
  const monthEnd = monthDays[monthDays.length - 1] ?? `${month}-31`;
  const byKey = new Map(logs.map((log) => [logKey(log), log]));
  const getLog = (habitId: string, date: string) => byKey.get(`${date}_${habitId}_1`);

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-card", styles.gridFrame)}>
      <div className="min-w-max">
        <div className={cn("flex border-b border-border", styles.gridHead)}>
          <div className={cn("sticky left-0 z-10 w-40 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-semibold", styles.gridLabel)}>
            Habit
          </div>
          {weeks.map((week, index) => (
            <div key={index} className="flex flex-col items-center px-1">
              <span className="py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Week {index + 1}
              </span>
              <div className="flex">
                {week.map((day) => (
                  <div key={day.toISOString()} className="w-11 text-center">
                    <div className="text-[11px] font-semibold tabular">{format(day, "d")}</div>
                    <div className="text-[9px] text-muted-foreground">{format(day, "EEE").charAt(0)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="w-14 shrink-0 px-2 py-2 text-center text-xs font-semibold">%</div>
        </div>

        {habits.map((habit) => {
          const habitLogs = logs.filter((log) => log.habitId === habit.id);
          const scheduledDates = scheduledDatesForRange(
            schedules,
            exceptions,
            monthStart,
            monthEnd,
            habit.id
          );
          const scheduledSet = new Set(scheduledDates);
          const rate = habitCompletionRate(habitLogs, scheduledDates);
          return (
            <div key={habit.id} className="flex border-b border-border last:border-b-0">
              <Link
                href={`/app/habits/${habit.id}`}
                className={cn("sticky left-0 z-10 flex w-40 shrink-0 items-center gap-2 border-r border-border bg-card px-3 py-2 text-xs font-medium hover:bg-muted", styles.gridLabel)}
                title={`Open ${habit.name} details`}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: habit.color }} />
                <span className="truncate">{habit.name}</span>
              </Link>
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex items-center px-1">
                  {week.map((day) => {
                    const date = format(day, "yyyy-MM-dd");
                    const log = getLog(habit.id, date);
                    const next = cycleStatus(log?.status);
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => onCellTap(habit.id, date, next)}
                        aria-label={`${habit.name} on ${format(day, "MMM d")}: ${statusIcon(log?.status)}${scheduledSet.has(date) ? "" : " (not scheduled)"} (tap for ${statusIcon(next)})`}
                        title={`${format(day, "MMM d")} · ${statusIcon(log?.status)}${scheduledSet.has(date) ? "" : " · not scheduled"}`}
                        className={cn(
                          "tap-target m-0.5 flex items-center justify-center rounded border text-[13px] font-bold transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring",
                          styles.gridCell,
                          statusTone(log?.status)
                        )}
                      >
                        {statusIcon(log?.status)}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className={cn("flex w-14 shrink-0 items-center justify-center text-xs font-bold tabular", styles.gridCell, rateTone(rate))}>
                {Math.round(rate * 100)}%
              </div>
            </div>
          );
        })}

        <div className={cn("flex bg-muted/30", styles.gridFoot)}>
          <div className={cn("sticky left-0 z-10 w-40 shrink-0 border-r border-border bg-muted px-3 py-2 text-xs font-semibold", styles.gridLabel)}>
            Daily score
          </div>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex items-center px-1">
              {week.map((day) => {
                const date = format(day, "yyyy-MM-dd");
                const dayLogs = logs.filter((log) => log.date === date);
                const score = dayLogs.length ? dailyScore(dayLogs) : null;
                return (
                  <div
                    key={date}
                    className={cn(
                      "m-0.5 flex size-8 items-center justify-center rounded border border-border text-[10px] font-bold tabular",
                      styles.gridCell,
                      rateTone(score)
                    )}
                    title={score === null ? "No logs" : `${Math.round(score * 100)}%`}
                  >
                    {score === null ? "–" : Math.round(score * 100)}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="w-14 shrink-0" />
        </div>
      </div>
    </div>
  );
}
