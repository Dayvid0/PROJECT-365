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

export const HABIT_KINDS = ["check_in", "count", "timer"] as const;

export const CADENCE_KINDS = ["daily", "weekly", "interval", "monthly"] as const;

export const CHECKIN_SOURCES = ["manual", "import", "timer", "system"] as const;

export const SCHEDULE_EXCEPTION_KINDS = ["skip", "planned_break"] as const;

export const STREAK_POLICIES = ["strict", "target", "off"] as const;

/** Sharing is opt-in and field-level; "none" still keeps the grant for revocation history. */
export const SHARE_AUDIENCES = ["partner", "circle"] as const;
export const SHARE_FIELDS = [
  "name",
  "alias",
  "status",
  "quantity",
  "note",
  "history",
] as const;
export const SHARE_FREQUENCIES = [
  "every_check_in",
  "weekly_summary",
  "milestone_only",
  "none",
] as const;

export const PARTNER_INVITE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
] as const;

/** Circles are invite-only. Owner/admin manage membership; members only share by grant. */
export const CIRCLE_ROLES = ["owner", "admin", "member"] as const;
export const CIRCLE_ASSIGNABLE_ROLES = ["admin", "member"] as const;
export const CIRCLE_INVITE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
] as const;

/** Support is explicit and positive; there are no downvotes or comparison metrics. */
export const CIRCLE_REACTION_KINDS = ["cheer", "support", "respect"] as const;

export const SAFETY_CONTROL_KINDS = ["block", "mute", "leave"] as const;
export const REPORT_TARGET_TYPES = ["user", "content", "circle"] as const;
export const REPORT_CATEGORIES = [
  "harassment",
  "shame_pressure",
  "privacy",
  "spam",
  "other",
] as const;
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const;

export const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
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
