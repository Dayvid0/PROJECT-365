"use client";

import { useMemo, useState } from "react";
import { Check, Minus, MoreHorizontal, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { statusFromValue } from "@/domain/calculations";
import type {
  Habit,
  HabitLog,
  HabitSchedule,
  ScheduleException,
  ScheduledOpportunity,
} from "@/domain/types";
import { useExternalClock } from "@/lib/hooks/use-external-clock";
import { useLocalTimer } from "@/lib/hooks/use-local-timer";
import { cn } from "@/lib/utils";
import styles from "./today-habit-card.module.css";

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

export function TodayHabitCard({
  habit,
  date,
  opportunities,
  logs,
  schedule,
  exception,
  onSave,
  onUndo,
  onSkip,
  onUnskip,
}: {
  habit: Habit;
  date: string;
  opportunities: ScheduledOpportunity[];
  logs: HabitLog[];
  schedule?: HabitSchedule;
  exception?: ScheduleException;
  onSave: (logs: HabitLog[]) => Promise<void>;
  onUndo: () => Promise<void>;
  onSkip: () => Promise<void>;
  onUnskip?: () => Promise<void>;
}) {
  const [details, setDetails] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countDraft, setCountDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [timer, setTimer] = useLocalTimer(habit.id, date);
  const now = useExternalClock(1000) ?? 0;

  const primaryLog = useMemo(
    () => logs.find((log) => (log.occurrence ?? 1) === 1) ?? logs[0],
    [logs]
  );
  const targetValue = habit.targetValue ?? schedule?.targetValue ?? 1;
  const unit = habit.unit ?? schedule?.unit ?? "";
  const targetSeconds = habit.targetDurationSeconds ?? schedule?.targetDurationSeconds ?? 60;

  const makeLog = (overrides: Partial<HabitLog> = {}): HabitLog => ({
    habitId: habit.id,
    date,
    status: 1,
    occurrence: 1,
    updatedAt: new Date().toISOString(),
    value: null,
    unit: null,
    note: null,
    source: "manual",
    ...primaryLog,
    ...overrides,
  });

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const saveValue = (value: number, extra: Partial<HabitLog> = {}) => {
    const status = statusFromValue(habit, value);
    return onSave([makeLog({ status, value, unit: unit || null, ...extra })]);
  };

  const elapsedSeconds =
    timer.accumulatedSeconds +
    (timer.startedAt ? Math.max(0, Math.floor((now - timer.startedAt) / 1000)) : 0);

  const currentValue = primaryLog?.value ?? 0;
  const completedOccurrences = opportunities.filter((opportunity) =>
    logs.some(
      (log) =>
        (log.occurrence ?? 1) === opportunity.occurrence && (log.status ?? 0) >= 1
    )
  ).length;
  const loggedOccurrences = opportunities.filter((opportunity) =>
    logs.some(
      (log) =>
        (log.occurrence ?? 1) === opportunity.occurrence && (log.status ?? 0) > 0
    )
  ).length;

  const statusLabel = exception
    ? exception.kind === "planned_break"
      ? "On a planned break"
      : "Skipped"
    : opportunities.length === 0
      ? "Not scheduled"
      : completedOccurrences === opportunities.length
        ? "Complete"
        : completedOccurrences > 0
          ? `Partial · ${completedOccurrences} of ${opportunities.length}`
          : loggedOccurrences > 0
            ? "Partial · progress saved"
            : "Pending";

  const allDone = opportunities.length > 0 && completedOccurrences === opportunities.length;

  const controls = () => {
    if (habit.kind === "count") {
      return (
        <div className={styles.controls}>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Decrease ${habit.name} by one`}
            disabled={busy || currentValue <= 0}
            onClick={() => void run(() => saveValue(Math.max(0, currentValue - 1)))}
          >
            <Minus />
          </Button>
          <output className={styles.countOutput} aria-live="polite">
            {currentValue}
            {unit ? <span className={styles.countUnit}>{unit}</span> : null}
            <span className={styles.countTarget}>/ {targetValue}</span>
          </output>
          <Button
            variant="outline"
            size="icon"
            aria-label={`Increase ${habit.name} by one`}
            disabled={busy}
            onClick={() => void run(() => saveValue(currentValue + 1))}
          >
            <Plus />
          </Button>
          <div className={styles.amountGroup}>
            <Input
              className={styles.amountInput}
              inputMode="decimal"
              aria-label={`Custom amount for ${habit.name}`}
              placeholder="Set"
              value={countDraft}
              onChange={(event) => setCountDraft(event.target.value)}
            />
            <Button
              variant="secondary"
              aria-label={`Set amount for ${habit.name}`}
              disabled={busy || countDraft.trim() === ""}
              onClick={() => {
                const parsed = Number(countDraft);
                if (!Number.isFinite(parsed) || parsed < 0) return;
                void run(() => saveValue(parsed)).then(() => setCountDraft(""));
              }}
            >
              Set
            </Button>
          </div>
        </div>
      );
    }

    if (habit.kind === "timer") {
      return (
        <div className={styles.controls}>
          <output className={styles.timerOutput} aria-live="polite">
            {formatDuration(elapsedSeconds)}
            <span className={styles.countTarget}>/ {formatDuration(targetSeconds)}</span>
          </output>
          {timer.startedAt === null ? (
            <Button
              disabled={busy}
              aria-label={`${elapsedSeconds > 0 ? "Resume" : "Start"} timer for ${habit.name}`}
              onClick={() => setTimer({ accumulatedSeconds: elapsedSeconds, startedAt: Date.now() })}
            >
              <Play /> {elapsedSeconds > 0 ? "Resume" : "Start"}
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={busy}
              aria-label={`Pause timer for ${habit.name}`}
              onClick={() => setTimer({ accumulatedSeconds: elapsedSeconds, startedAt: null })}
            >
              <Pause /> Pause
            </Button>
          )}
          <Button
            variant="outline"
            aria-label={`Finish timer for ${habit.name}`}
            disabled={busy || elapsedSeconds === 0}
            onClick={() =>
              void run(async () => {
                await saveValue(elapsedSeconds, {
                  startedAt: new Date(
                    Date.now() - elapsedSeconds * 1000
                  ).toISOString(),
                  endedAt: new Date().toISOString(),
                });
                setTimer({ startedAt: null, accumulatedSeconds: 0 });
              })
            }
          >
            <Check /> Finish
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="lg"
        className={styles.primaryAction}
        disabled={busy || opportunities.length === 0}
        aria-label={`${allDone ? "Undo" : "Mark done"}: ${habit.name}`}
        onClick={() =>
          void run(async () => {
            if (allDone) await onUndo();
            else {
              const targets = opportunities.length
                ? opportunities.map((opportunity) => opportunity.occurrence)
                : [1];
              await onSave(
                targets.map((occurrence) =>
                  makeLog({ occurrence, status: 1, value: null })
                )
              );
            }
          })
        }
      >
        {allDone ? <RotateCcw /> : <Check />}
        {allDone ? "Undo" : "Mark done"}
      </Button>
    );
  };

  return (
    <li className={cn(styles.item, allDone && styles.itemComplete)}>
      <div className={styles.itemHead}>
        <div>
          <div className={styles.itemIdentity}>
            <span
              className={styles.habitDot}
              style={{ backgroundColor: habit.color }}
              aria-hidden="true"
            />
            <p className={styles.habitName}>{habit.name}</p>
          </div>
          <p className={styles.status}>{statusLabel}</p>
        </div>
        <Badge variant="outline" className={styles.kind}>
          {habit.kind === "check_in" ? "Check-in" : habit.kind === "count" ? "Count" : "Timer"}
        </Badge>
      </div>

      {opportunities.length > 0 ? (
        <div className="mt-3">{controls()}</div>
      ) : (
        <div>
          <p className={styles.restNote}>
            {exception
              ? "Rest is part of the plan. No catch-up needed."
              : "Nothing due today. Enjoy the breathing room."}
          </p>
          {exception && onUnskip && (
            <div className={styles.restActions}>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Put ${habit.name} back on the schedule`}
                onClick={() => void run(onUnskip)}
              >
                <RotateCcw /> Put it back on the schedule
              </Button>
            </div>
          )}
        </div>
      )}

      {opportunities.length > 0 && (
        <div className={styles.secondary}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={details}
            aria-label={`Note for ${habit.name}`}
            onClick={() => {
              setNoteDraft(primaryLog?.note ?? "");
              setDetails((open) => !open);
            }}
          >
            <MoreHorizontal /> Note
          </Button>
          {!allDone && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Skip ${habit.name} today`}
              onClick={() => setConfirmSkip(true)}
            >
              Skip today
            </Button>
          )}
          {logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Undo check-in for ${habit.name}`}
              disabled={busy}
              onClick={() => void run(onUndo)}
            >
              <RotateCcw /> Undo check-in
            </Button>
          )}
        </div>
      )}

      {details && (
        <form
          className={styles.noteForm}
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onSave([makeLog({ note: noteDraft.trim() || null })]));
          }}
        >
          <label className={styles.noteLabel} htmlFor={`note-${habit.id}`}>
            Note for {habit.name}
          </label>
          <Input
            id={`note-${habit.id}`}
            className={styles.noteInput}
            maxLength={2000}
            placeholder="How did it go?"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="secondary"
            aria-label={`Save note for ${habit.name}`}
            disabled={busy}
          >
            Save note
          </Button>
        </form>
      )}

      <Dialog open={confirmSkip} onOpenChange={setConfirmSkip}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip {habit.name} today?</DialogTitle>
            <DialogDescription>
              Skipping removes today from your schedule. It will not count as a miss, and it will
              not break a streak or lower your completion rate. You can undo this from the
              habit page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSkip(false)}>
              Keep it scheduled
            </Button>
            <Button
              onClick={() =>
                void run(async () => {
                  await onSkip();
                  setConfirmSkip(false);
                })
              }
            >
              Skip today
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
