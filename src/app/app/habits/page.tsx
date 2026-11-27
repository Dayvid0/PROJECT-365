"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  ListChecks,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import styles from "@/components/tracking/tracking.module.css";
import { HABIT_CATEGORIES, PRESET_HABIT_COLORS } from "@/lib/constants";
import { useCreateHabit, useHabits, useUpdateHabit } from "@/lib/hooks/use-workspace";
import type { Habit, HabitCategory } from "@/domain/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "archived";

interface FormState {
  habitId: string | null;
  name: string;
  category: HabitCategory;
  color: string;
}

const EMPTY_FORM: FormState = {
  habitId: null,
  name: "",
  category: "health",
  color: PRESET_HABIT_COLORS[0],
};

export default function HabitsPage() {
  const userId = useWorkspaceUserId();
  const { habits, isLoading, isError } = useHabits(userId);
  const createHabit = useCreateHabit(userId);
  const updateHabit = useUpdateHabit(userId);
  const [form, setForm] = useState<FormState | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState<HabitCategory | "all">("all");

  const matching = habits.filter((habit) => {
    const matchesQuery = habit.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus =
      status === "all" || (status === "active" ? habit.isActive : !habit.isActive);
    const matchesCategory = category === "all" || habit.category === category;
    return matchesQuery && matchesStatus && matchesCategory;
  });
  const active = matching.filter((habit) => habit.isActive);
  const archived = matching.filter((habit) => !habit.isActive);
  const pending = createHabit.isPending || updateHabit.isPending;

  const openEdit = (habit: Habit) =>
    setForm({
      habitId: habit.id,
      name: habit.name,
      category: habit.category,
      color: habit.color,
    });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form?.name.trim()) return;
    try {
      if (form.habitId) {
        await updateHabit.mutateAsync({
          habitId: form.habitId,
          name: form.name.trim(),
          category: form.category,
          color: form.color,
        });
      } else {
        await createHabit.mutateAsync({
          name: form.name.trim(),
          category: form.category,
          color: form.color,
          order: habits.length,
          isActive: true,
          kind: "check_in",
        });
      }
      setForm(null);
    } catch {
      // Error toasts are handled by the mutation hooks.
    }
  };

  const toggleArchived = (habit: Habit) => {
    updateHabit.mutate({ habitId: habit.id, isActive: !habit.isActive });
  };

  const renderRows = (list: Habit[], isArchived: boolean) =>
    list.map((habit) => (
      <div key={habit.id} className={cn("flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5", styles.row)}>
        <span className={styles.rowDot} style={{ backgroundColor: habit.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/app/habits/${habit.id}`}
            className={cn("block truncate text-sm font-semibold hover:underline", isArchived && "text-muted-foreground line-through")}
          >
            {habit.name}
          </Link>
          <p className={cn(styles.rowMeta, "capitalize")}>{habit.category}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={`Edit ${habit.name}`} onClick={() => openEdit(habit)}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isArchived ? `Restore ${habit.name}` : `Archive ${habit.name}`}
          title={isArchived ? "Restore habit" : "Archive habit — history is kept"}
          onClick={() => toggleArchived(habit)}
        >
          {isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        </Button>
      </div>
    ));

  return (
    <div className={cn("space-y-6", styles.page)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", styles.pageHead)}>
        <div>
          <span className={styles.eyebrow}>SHAPE YOUR ROUTINE</span>
          <h1 className={styles.title}>Habits</h1>
          <p className={styles.subtitle}>Archive keeps your history intact.</p>
        </div>
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>
          <Plus className="size-4" /> Add habit
        </Button>
      </div>

      <div className="space-y-3">
        <div className={cn("flex items-center gap-2", styles.actions)}>
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search habits"
            placeholder="Search habits"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className={styles.chipRow} role="group" aria-label="Filter by status">
          {(["all", "active", "archived"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={cn(styles.chip, status === value && styles.chipActive)}
            >
              {value === "all" ? "All" : value === "active" ? "Active" : "Archived"}
            </button>
          ))}
        </div>
        <div className={styles.chipRow} role="group" aria-label="Filter by category">
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
            className={cn(styles.chip, category === "all" && styles.chipActive)}
          >
            Every category
          </button>
          {HABIT_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(styles.chip, category === value && styles.chipActive, "capitalize")}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Could not load habits. Refresh to retry.</p>
      ) : isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : habits.length === 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="items-center text-center">
            <ListChecks className="size-10 text-muted-foreground" />
            <CardTitle>No habits yet</CardTitle>
            <CardDescription>Create one, or revisit onboarding for the starter set.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button onClick={() => setForm({ ...EMPTY_FORM })}>Create a habit</Button>
            <Button variant="outline" asChild>
              <a href="/onboarding">See starter set</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className={styles.sectionLabel}>Active ({active.length})</h2>
            {active.length ? renderRows(active, false) : <p className={styles.empty}>Nothing matches these filters yet.</p>}
          </section>
          {archived.length > 0 ? (
            <section className="space-y-2">
              <h2 className={styles.sectionLabel}>Archived ({archived.length})</h2>
              {renderRows(archived, true)}
            </section>
          ) : null}
          <p className={styles.privacyNote}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            <span>
              <strong>Private by default.</strong> Your habits and their history belong to your
              account. Sharing only happens through an invite-only Circle you create.
            </span>
          </p>
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.habitId ? "Edit habit" : "New habit"}</DialogTitle>
            <DialogDescription>Name, category, and colour can all change later.</DialogDescription>
          </DialogHeader>
          {form ? (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="habit-name">Name</Label>
                <Input
                  id="habit-name"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Read 30 minutes"
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Category</span>
                <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
                  {HABIT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={form.category === category}
                      onClick={() => setForm({ ...form, category })}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium capitalize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        form.category === category
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Colour</span>
                <div role="group" aria-label="Colour" className="flex flex-wrap gap-2">
                  {PRESET_HABIT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Choose ${color}`}
                      aria-pressed={form.color === color}
                      onClick={() => setForm({ ...form, color })}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        form.color === color ? "border-foreground" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {form.habitId ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
