import { z } from "zod";
import { HABIT_CATEGORIES } from "@/lib/constants";

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

export const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colour must be a hex value.");

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  category: categorySchema,
  color: hexColorSchema,
  order: z.number().int().min(0).max(100_000),
  isActive: z.boolean().default(true),
});

export const updateHabitSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    category: categorySchema.optional(),
    color: hexColorSchema.optional(),
    order: z.number().int().min(0).max(100_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const habitLogSchema = z.object({
  habitId: z.string().min(1),
  date: dateSchema,
  status: statusSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export const upsertLogsSchema = z
  .array(habitLogSchema)
  .min(1, "At least one log is required.")
  .max(10_000, "Too many logs in one request.");

export const profilePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    timezone: z.string().min(1).max(120).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const preferencesPatchSchema = z
  .object({
    theme: z.enum(["light", "dark"]).optional(),
    notificationTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm.")
      .optional(),
    onboardingCompleted: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes supplied.");

export const onboardingModeSchema = z.object({
  mode: z.enum(["defaults", "scratch"]),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
export type UpsertLogsInput = z.infer<typeof upsertLogsSchema>;
export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
export type PreferencesPatchSchemaType = z.infer<typeof preferencesPatchSchema>;
