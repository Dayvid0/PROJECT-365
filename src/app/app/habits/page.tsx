"use client";

import { useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  ListChecks,
  Pencil,
  Plus,
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
import { HABIT_CATEGORIES, PRESET_HABIT_COLORS } from "@/lib/constants";
import { useCreateHabit, useHabits, useUpdateHabit } from "@/lib/hooks/use-workspace";
import type { Habit, HabitCategory } from "@/domain/types";
import { cn } from "@/lib/utils";

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

  const active = habits.filter((habit) => habit.isActive);
  const archived = habits.filter((habit) => !habit.isActive);
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
      <div
        key={habit.id}
        className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5"
      >
        <span className="size-3 rounded-full" style={{ backgroundColor: habit.color }} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold", isArchived && "text-muted-foreground line-through")}>
            {habit.name}
          </p>
          <p className="text-[11px] capitalize text-muted-foreground">{habit.category}</p>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Habits</h1>
          <p className="text-sm text-muted-foreground">Archive keeps your history intact.</p>
        </div>
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>
          <Plus className="size-4" /> Add habit
        </Button>
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active ({active.length})
            </h2>
            {active.length ? renderRows(active, false) : <p className="text-sm text-muted-foreground">All habits are archived.</p>}
          </section>
          {archived.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Archived ({archived.length})
              </h2>
              {renderRows(archived, true)}
            </section>
          ) : null}
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
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {HABIT_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setForm({ ...form, category })}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
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
                <Label>Colour</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_HABIT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Choose ${color}`}
                      onClick={() => setForm({ ...form, color })}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform hover:scale-110",
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
