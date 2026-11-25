import { STATUS_LABELS } from "@/lib/constants";
import type { Habit, HabitLog } from "./types";

export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Stable, human-readable export used by the Settings screen download. */
export function buildHabitCsv(habits: Habit[], logs: HabitLog[]): string {
  const habitNames = new Map(habits.map((habit) => [habit.id, habit.name]));
  const rows = [
    ["Date", "Habit", "Status", "Category", "Updated At"],
    ...[...logs]
      .sort((a, b) => a.date.localeCompare(b.date) || a.habitId.localeCompare(b.habitId))
      .map((log) => {
        const habit = habits.find((candidate) => candidate.id === log.habitId);
        return [
          log.date,
          habitNames.get(log.habitId) ?? habit?.name ?? log.habitId,
          STATUS_LABELS[log.status],
          habit?.category ?? "",
          log.updatedAt,
        ];
      }),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}
