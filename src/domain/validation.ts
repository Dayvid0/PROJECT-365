import { z } from "zod";
import {
  CADENCE_KINDS,
  CHECKIN_SOURCES,
  HABIT_CATEGORIES,
  HABIT_KINDS,
  SCHEDULE_EXCEPTION_KINDS,
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

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type UpsertLogsInput = z.infer<typeof upsertLogsSchema>;
export type CreateScheduleVersionInput = z.infer<typeof createScheduleVersionSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type PreferencesPatchSchemaType = z.infer<typeof preferencesPatchSchema>;
export type DeleteLogInput = z.infer<typeof deleteLogSchema>;
export type HabitReminderInput = z.infer<typeof habitReminderSchema>;
