import { describe, expect, it } from "vitest";
import { buildHabitCsv, escapeCsvCell } from "../csv";
import type { Habit, HabitLog } from "../types";

const habits: Habit[] = [
  {
    id: "a",
    name: 'Read, "deep" work',
    category: "learning",
    order: 0,
    isActive: true,
    description: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    color: "#3B82F6",
    kind: "check_in",
    targetValue: null,
    unit: null,
    targetDurationSeconds: null,
  },
];

describe("CSV export", () => {
  it("quotes commas and embedded quotes", () => {
    expect(escapeCsvCell('Read, "deep" work')).toBe('"Read, ""deep"" work"');
  });

  it("emits a stable header and status labels", () => {
    const logs: HabitLog[] = [
      { habitId: "a", date: "2026-01-02", status: 0.5, updatedAt: "2026-01-02T10:00:00.000Z" },
      { habitId: "a", date: "2026-01-01", status: 1, updatedAt: "2026-01-01T10:00:00.000Z" },
    ];
    expect(buildHabitCsv(habits, logs)).toBe(
      [
        "Date,Habit,Status,Category,Updated At",
        '2026-01-01,"Read, ""deep"" work",Complete,learning,2026-01-01T10:00:00.000Z',
        '2026-01-02,"Read, ""deep"" work",Partial,learning,2026-01-02T10:00:00.000Z',
      ].join("\r\n")
    );
  });

  it("falls back to the habit id for logs whose habit was removed", () => {
    expect(buildHabitCsv([], [{ habitId: "gone", date: "2026-01-01", status: 0, updatedAt: "2026-01-01T10:00:00.000Z" }])).toContain(
      "2026-01-01,gone,Missed,"
    );
  });
});
