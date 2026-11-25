import type { Habit, HabitCategory } from "./types";
import { CATEGORY_COLORS } from "@/lib/constants";

export interface DefaultHabitSeed {
  name: string;
  category: HabitCategory;
  color: string;
}

/** The 25 starter habits from the original Expo onboarding screen. */
export const DEFAULT_HABIT_SEEDS: readonly DefaultHabitSeed[] = [
  { name: "Wake up at 4:30", category: "routine", color: "#F59E0B" },
  { name: "Meditate", category: "mindset", color: "#8B5CF6" },
  { name: "Pray and read Daily Text", category: "mindset", color: "#8B5CF6" },
  { name: "Push-ups", category: "health", color: "#22C55E" },
  { name: "Read 30 minutes", category: "learning", color: "#3B82F6" },
  { name: "Organised Environment", category: "routine", color: "#EC4899" },
  { name: "Journal", category: "mindset", color: "#8B5CF6" },
  { name: "Code 30 minutes", category: "learning", color: "#3B82F6" },
  { name: "Educational Podcasts", category: "learning", color: "#3B82F6" },
  { name: "Arrive at work at 8am", category: "work", color: "#F59E0B" },
  { name: "Sober", category: "health", color: "#22C55E" },
  { name: "Hydrate (full water bottle)", category: "health", color: "#22C55E" },
  { name: "Positivity / Mindfulness", category: "mindset", color: "#8B5CF6" },
  { name: "Gratitude", category: "mindset", color: "#8B5CF6" },
  { name: "Exercise", category: "health", color: "#22C55E" },
  { name: "Eat Healthy", category: "health", color: "#22C55E" },
  { name: "Odoo Documentation", category: "work", color: "#F59E0B" },
  { name: "Chores", category: "routine", color: "#EC4899" },
  { name: "Plan the next day", category: "routine", color: "#EC4899" },
  { name: "Work on Final Year Project", category: "work", color: "#F59E0B" },
  { name: "Brush twice", category: "routine", color: "#EC4899" },
  { name: "Shower", category: "routine", color: "#EC4899" },
  { name: "Less Social Media", category: "mindset", color: "#8B5CF6" },
  { name: "Daily check-in on sheet", category: "routine", color: "#EC4899" },
  { name: "Sleep at 11pm", category: "routine", color: "#F59E0B" },
];

export function buildDefaultHabits(
  makeId: () => string = () => crypto.randomUUID(),
  now: Date = new Date()
): Habit[] {
  return DEFAULT_HABIT_SEEDS.map((seed, index) => ({
    id: makeId(),
    name: seed.name,
    description: null,
    category: seed.category,
    color: seed.color || CATEGORY_COLORS[seed.category],
    order: index,
    isActive: true,
    createdAt: now.toISOString(),
    kind: "check_in",
    targetValue: null,
    unit: null,
    targetDurationSeconds: null,
  }));
}
