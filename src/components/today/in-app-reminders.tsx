"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Habit, HabitLog, HabitReminder, UserProfile } from "@/domain/types";
import { weekdayOf } from "@/domain/schedule";
import { useExternalClock } from "@/lib/hooks/use-external-clock";

function minuteOfDay(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function zonedClock(date: Date, timezone: string): { minutes: number; label: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
    return { minutes: Number(hour) * 60 + Number(minute), label: `${hour}:${minute}` };
  } catch {
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    return { minutes: date.getUTCHours() * 60 + date.getUTCMinutes(), label: `${hour}:${minute}` };
  }
}

function withinQuietHours(minutes: number, start: string, end: string): boolean {
  const from = minuteOfDay(start);
  const until = minuteOfDay(end);
  if (from === until) return false;
  if (from < until) return minutes >= from && minutes < until;
  return minutes >= from || minutes < until;
}

/** Honest web-only nudges: visible here while the tab is open, no push delivery. */
export function InAppReminders({
  habits,
  reminders,
  user,
  date,
  logs,
}: {
  habits: Habit[];
  reminders: HabitReminder[];
  user?: UserProfile;
  date: string;
  logs: HabitLog[];
}) {
  const [preview, setPreview] = useState(false);
  const tick = useExternalClock(60_000);

  if (!user?.remindersEnabled || reminders.length === 0) return null;

  const now = tick === null ? null : new Date(tick);

  const clock = now ? zonedClock(now, user.timezone) : null;
  const quiet = clock
    ? withinQuietHours(clock.minutes, user.quietHoursStart, user.quietHoursEnd)
    : false;
  const habitNames = new Map(habits.map((habit) => [habit.id, habit.name]));
  const due = clock
    ? reminders.filter((reminder) => {
        if (!reminder.enabled || quiet) return false;
        if (
          reminder.weekdays.length > 0 &&
          !reminder.weekdays.includes(weekdayOf(date))
        ) {
          return false;
        }
        const completed = logs.some(
          (log) =>
            log.habitId === reminder.habitId &&
            log.date === date &&
            (log.status ?? 0) >= 1
        );
        if (reminder.stopAfterCompletion && completed) return false;
        const start = minuteOfDay(reminder.time);
        return clock.minutes >= start && clock.minutes - start <= 120;
      })
    : [];

  return (
    <Card className="border-primary/30 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="size-4 text-primary" /> Gentle nudges
        </CardTitle>
        <CardDescription>
          Live status: on while this tab is open. No push notifications are sent by the web app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!clock ? (
          <p className="text-xs text-muted-foreground">Checking reminder times…</p>
        ) : due.length ? (
          <ul className="space-y-1">
            {due.map((reminder) => (
              <li key={reminder.id} className="text-sm">
                <span className="font-semibold">{habitNames.get(reminder.habitId) ?? "A habit"}</span>
                <span className="text-muted-foreground"> · scheduled for {reminder.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            {quiet ? "Quiet hours are active. Nothing will nudge you now." : "Nothing due right now."}
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={() => setPreview((open) => !open)}>
          {preview ? "Hide sample" : "Preview a nudge"}
        </Button>
        {preview ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs">
            Sample: “A small step still counts when you’re ready.”
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
