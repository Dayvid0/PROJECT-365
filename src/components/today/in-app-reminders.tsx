"use client";

import { useState } from "react";
import { Bell, Clock3 } from "lucide-react";
import styles from "@/components/trust/trust.module.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Habit, HabitLog, HabitReminder, UserProfile } from "@/domain/types";
import {
  endOfLocalDay,
  evaluateReminder,
  type ReminderStatus,
  type ReminderSuppression,
} from "@/domain/reminders";
import { useExternalClock } from "@/lib/hooks/use-external-clock";

const HELD_STATES: ReminderStatus["state"][] = ["snoozed", "dismissed", "quiet"];

const STATE_LABELS: Record<ReminderStatus["state"], string> = {
  due: "Due now",
  waiting: "Waiting",
  snoozed: "Snoozed",
  dismissed: "Dismissed",
  quiet: "Quiet hours",
  complete: "Complete",
  wrong_day: "Not scheduled",
  inactive: "Off",
};

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
  const [showStatus, setShowStatus] = useState(false);
  const [suppressions, setSuppressions] = useState<Record<string, ReminderSuppression>>({});
  const tick = useExternalClock(60_000);

  if (!user?.remindersEnabled || reminders.length === 0) return null;

  const now = tick === null ? null : new Date(tick);
  const habitNames = new Map(habits.map((habit) => [habit.id, habit.name]));
  const statuses = now
    ? reminders.map((reminder) =>
        evaluateReminder({
          reminder,
          habitName: habitNames.get(reminder.habitId) ?? "A habit",
          now,
          date,
          timezone: user.timezone,
          quietHoursStart: user.quietHoursStart,
          quietHoursEnd: user.quietHoursEnd,
          logs,
          suppression: suppressions[reminder.id],
        })
      )
    : [];
  const due = statuses.filter((item) => item.state === "due");
  const held = statuses.filter((item) => HELD_STATES.includes(item.state));

  const hold = (reminder: HabitReminder, kind: ReminderSuppression["kind"]) => {
    setSuppressions((current) => ({
      ...current,
      [reminder.id]: {
        kind,
        date,
        until:
          kind === "dismiss"
            ? endOfLocalDay(new Date(), user.timezone)
            : Date.now() + reminder.snoozeMinutes * 60_000,
      },
    }));
  };

  return (
    <Card className={styles.panelAccent}>
      <CardHeader className="pb-2">
        <CardTitle className={styles.subsectionTitle}>
          <span className="flex items-center gap-2">
            <Bell className="size-4 text-primary" /> Gentle nudges
          </span>
        </CardTitle>
        <CardDescription className={styles.panelDescription}>
          On while this tab is open. No push notifications, no OS permission, and nothing shown to
          anyone else. Quiet hours are respected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!now ? (
          <p className={styles.empty}>Checking reminder times…</p>
        ) : due.length ? (
          <ul className="space-y-2">
            {due.map((item) => {
              const reminder = reminders.find((entry) => entry.id === item.id);
              return (
                <li key={item.id} className={styles.row}>
                  <span className="text-sm">
                    <span className="font-semibold">{item.habitName}</span>
                    <span className="text-muted-foreground"> · {item.time}</span>
                  </span>
                  {reminder ? (
                    <span className={styles.rowActions}>
                      {reminder.snoozeMinutes > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => hold(reminder, "snooze")}
                        >
                          Snooze {reminder.snoozeMinutes}m
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => hold(reminder, "dismiss")}>
                        Dismiss
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>Nothing needs a nudge right now.</p>
        )}

        {held.length > 0 ? (
          <p className={styles.rowMeta}>
            {held.map((item) => item.detail).join(" ")}
          </p>
        ) : null}

        <div className={`${styles.rowActions} border-t border-border pt-3`}>
          <Button variant="ghost" size="sm" onClick={() => setPreview((open) => !open)}>
            {preview ? "Hide sample" : "Preview a nudge"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowStatus((open) => !open)}>
            {showStatus ? "Hide status" : "Check status"}
          </Button>
        </div>

        {preview ? (
          <p className={styles.note}>
            Sample: “A small step still counts when you’re ready.” No habit details are shown here
            in a preview.
          </p>
        ) : null}

        {showStatus ? (
          <div className="space-y-2 border-t border-border pt-3">
            <p className={styles.privacyNote}>
              <Clock3 className="size-4" aria-hidden="true" />
              <span>
                Live status refreshes every minute. Snooze and dismiss last for this visit only.
              </span>
            </p>
            {statuses.length === 0 ? (
              <p className={styles.empty}>Checking reminder times…</p>
            ) : (
              <ul className="space-y-1">
                {statuses.map((item) => (
                  <li key={item.id} className={`${styles.row} text-xs`}>
                    <span className={styles.rowTitle}>{item.habitName}</span>
                    <span className={styles.rowMeta}>
                      {STATE_LABELS[item.state]} · {item.detail}
                      {item.nextDueMinutes !== null
                        ? ` · about ${item.nextDueMinutes} min`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
