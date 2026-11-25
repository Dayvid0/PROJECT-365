export const APP_NAME = "PROJECT_365";
export const APP_TAGLINE = "Track every day. Build every habit.";
export const DEFAULT_AUTHENTICATED_PATH = "/app";
export const DEFAULT_ONBOARDING_PATH = "/onboarding";

export const HABIT_CATEGORIES = [
  "health",
  "learning",
  "mindset",
  "work",
  "routine",
  "other",
] as const;

export const PRESET_HABIT_COLORS = [
  "#7C5CFC",
  "#22C55E",
  "#3B82F6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#06B6D4",
  "#14B8A6",
  "#F97316",
] as const;

export const CATEGORY_COLORS: Record<(typeof HABIT_CATEGORIES)[number], string> = {
  health: "#22C55E",
  learning: "#3B82F6",
  mindset: "#8B5CF6",
  work: "#F59E0B",
  routine: "#EC4899",
  other: "#6B7280",
};

export const STATUS_LABELS = {
  1: "Complete",
  0.5: "Partial",
  0: "Missed",
} as const;
