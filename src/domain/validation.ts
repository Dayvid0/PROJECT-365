import { z } from "zod";
import {
  CADENCE_KINDS,
  CHECKIN_SOURCES,
  HABIT_CATEGORIES,
  HABIT_KINDS,
  REPORT_CATEGORIES,
  REPORT_TARGET_TYPES,
  SAFETY_CONTROL_KINDS,
  SCHEDULE_EXCEPTION_KINDS,
  SHARE_AUDIENCES,
  SHARE_FIELDS,
  SHARE_FREQUENCIES,
  STREAK_POLICIES,
} from "@/lib/constants";

export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be YYYY-MM.");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Date must be a real calendar date.");

export const weeklyReviewQuerySchema = z.object({
  week: dateSchema.optional(),
});

export const weeklyNoteSchema = z.object({
  week: dateSchema,
  note: z.string().trim().max(2000, "Keep your reflection under 2000 characters."),
});

export type WeeklyNoteInput = z.infer<typeof weeklyNoteSchema>;

export const statusSchema = z.union([
  z.literal(0),
  z.literal(0.5),
  z.literal(1),
]);

export const categorySchema = z.enum(HABIT_CATEGORIES);
export const habitKindSchema = z.enum(HABIT_KINDS);
export const cadenceSchema = z.enum(CADENCE_KINDS);
export const checkInSourceSchema = z.enum(CHECKIN_SOURCES);
export const scheduleExceptionKindSchema = z.enum(SCHEDULE_EXCEPTION_KINDS);

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colour must be a hex value.");

export const timezoneSchema = z.string().min(1).max(120).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Timezone must be a valid IANA identifier.");

export const weekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .max(7)
  .refine((value) => new Set(value).size === value.length, "Weekdays must be unique.");

const scheduleInputObject = z.object({
  cadence: cadenceSchema.default("daily"),
  weekdays: weekdaysSchema.default([]),
  timesPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  intervalDays: z.number().int().min(1).max(3650).nullable().optional(),
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
  timesPerDay: z.number().int().min(1).max(12).default(1),
  targetValue: z.number().positive().nullable().optional(),
  unit: z.string().trim().min(1).max(32).nullable().optional(),
  targetDurationSeconds: z.number().int().positive().nullable().optional(),
  dayStartMinute: z.number().int().min(0).max(1439).default(0),
  timezone: timezoneSchema.optional(),
  effectiveFrom: dateSchema.optional(),
  anchorDate: dateSchema.optional(),
});

function refineSchedule(
  value: z.infer<typeof scheduleInputObject>,
  context: z.RefinementCtx
): void {
  if (value.cadence === "weekly" && value.weekdays.length === 0 && value.timesPerWeek == null) {
    context.addIssue({
      code: "custom",
      message: "Weekly schedules need weekdays or a times-per-week target.",
    });
  }
  if (value.cadence === "interval" && value.intervalDays == null) {
    context.addIssue({
      code: "custom",
      message: "Interval schedules need an interval in days.",
    });
  }
  if (value.cadence === "monthly" && value.monthDay == null) {
    context.addIssue({
      code: "custom",
      message: "Monthly schedules need a day of the month.",
    });
  }
}

export const scheduleInputSchema = scheduleInputObject.superRefine(refineSchedule);

export const createScheduleVersionSchema = scheduleInputObject
  .extend({ effectiveFrom: dateSchema })
  .superRefine(refineSchedule);

export const scheduleExceptionSchema = z
  .object({
    startDate: dateSchema,
    endDate: dateSchema,
    kind: scheduleExceptionKindSchema,
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date cannot be before the start date.",
  });

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  description: z.string().trim().max(500).nullable().optional(),
  category: categorySchema,
  color: hexColorSchema,
  order: z.number().int().min(0).max(100_000),
  isActive: z.boolean().default(true),
  kind: habitKindSchema.default("check_in"),
  targetValue: z.number().positive().nullable().optional(),
  unit: z.string().trim().min(1).max(32).nullable().optional(),
  targetDurationSeconds: z.number().int().positive().nullable().optional(),
  schedule: scheduleInputSchema.optional(),
});

export const updateHabitSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    category: categorySchema.optional(),
    color: hexColorSchema.optional(),
    order: z.number().int().min(0).max(100_000).optional(),
    isActive: z.boolean().optional(),
    kind: habitKindSchema.optional(),
    targetValue: z.number().positive().nullable().optional(),
    unit: z.string().trim().min(1).max(32).nullable().optional(),
    targetDurationSeconds: z.number().int().positive().nullable().optional(),
    schedule: scheduleInputSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const habitLogSchema = z.object({
  habitId: z.string().min(1),
  date: dateSchema,
  status: statusSchema.optional(),
  updatedAt: z.string().datetime({ offset: true }),
  occurrence: z.number().int().min(1).max(100).default(1),
  value: z.number().min(0).nullable().optional(),
  unit: z.string().trim().min(1).max(32).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  source: checkInSourceSchema.default("manual"),
  startedAt: z.string().datetime({ offset: true }).nullable().optional(),
  endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
  editedAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const upsertLogsSchema = z
  .array(habitLogSchema)
  .min(1, "At least one log is required.")
  .max(10_000, "Too many logs in one request.");

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm.");

export const deleteLogSchema = z.object({
  habitId: z.string().min(1),
  date: dateSchema,
  occurrence: z.coerce.number().int().min(1).max(100).default(1),
});

export const habitReminderSchema = z.object({
  enabled: z.boolean().default(true),
  time: timeSchema.default("08:00"),
  weekdays: weekdaysSchema.default([]),
  snoozeMinutes: z.number().int().min(0).max(240).default(10),
  stopAfterCompletion: z.boolean().default(true),
});

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    timezone: timezoneSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const preferencesPatchSchema = z
  .object({
    theme: z.enum(["light", "dark"]).optional(),
    notificationTime: timeSchema.optional(),
    onboardingCompleted: z.boolean().optional(),
    streakPolicy: z.enum(STREAK_POLICIES).optional(),
    remindersEnabled: z.boolean().optional(),
    quietHoursStart: timeSchema.optional(),
    quietHoursEnd: timeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const onboardingModeSchema = z.object({
  mode: z.enum(["defaults", "scratch"]),
});

export const partnerInviteSchema = z.object({
  email: z.email("Enter a valid email address.").max(320),
});

const shareFieldsSchema = z
  .array(z.enum(SHARE_FIELDS))
  .min(1, "Choose at least one field to share.")
  .max(SHARE_FIELDS.length)
  .refine((value) => new Set(value).size === value.length, "Fields must be unique.");

export const shareGrantSchema = z
  .object({
    audience: z.enum(SHARE_AUDIENCES),
    recipientId: z.string().trim().min(1).max(128).nullable().optional(),
    circleId: z.string().trim().min(1).max(128).nullable().optional(),
    habitId: z.string().min(1).max(128),
    alias: z.string().trim().min(1).max(80).nullable().optional(),
    fields: shareFieldsSchema,
    frequency: z.enum(SHARE_FREQUENCIES),
    consentVersion: z.number().int().min(1).max(100).default(1),
    startsAt: z.string().datetime({ offset: true }).optional(),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (value) =>
      value.audience === "partner"
        ? Boolean(value.recipientId) && !value.circleId
        : Boolean(value.circleId) && !value.recipientId,
    "Partner grants need a recipient; circle grants need a circle."
  )
  .refine(
    (value) => !value.fields.includes("alias") || Boolean(value.alias),
    "An alias is required when the alias field is shared."
  )
  .refine((value) => {
    if (!value.endsAt) return true;
    const start = value.startsAt ? new Date(value.startsAt) : new Date();
    return new Date(value.endsAt) > start;
  }, "The end time must be after the start time.");

export const safetyControlSchema = z
  .object({
    kind: z.enum(SAFETY_CONTROL_KINDS),
    targetUserId: z.string().trim().min(1).max(128).nullable().optional(),
    circleId: z.string().trim().min(1).max(128).nullable().optional(),
    expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (value) =>
      value.kind === "leave"
        ? Boolean(value.circleId) && !value.targetUserId
        : Boolean(value.targetUserId) && !value.circleId,
    "Blocking and muting need a user; leaving needs a circle."
  );

export const safetyReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().trim().min(1).max(128),
  targetUserId: z.string().trim().min(1).max(128).nullable().optional(),
  category: z.enum(REPORT_CATEGORIES),
  detail: z.string().trim().min(1).max(2000),
});

export const deleteAccountSchema = z.object({
  confirmation: z.string().trim().min(1, "Type your email to confirm.").max(320),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type UpsertLogsInput = z.infer<typeof upsertLogsSchema>;
export type CreateScheduleVersionInput = z.infer<typeof createScheduleVersionSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type PreferencesPatchSchemaType = z.infer<typeof preferencesPatchSchema>;
export type DeleteLogInput = z.infer<typeof deleteLogSchema>;
export type HabitReminderInput = z.infer<typeof habitReminderSchema>;
export type ShareGrantInput = z.infer<typeof shareGrantSchema>;
export type PartnerInviteInput = z.infer<typeof partnerInviteSchema>;
export type SafetyControlInput = z.infer<typeof safetyControlSchema>;
export type SafetyReportInput = z.infer<typeof safetyReportSchema>;
