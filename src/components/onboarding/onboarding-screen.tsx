"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_HABIT_SEEDS } from "@/domain/defaults";
import { useHabits, useOnboarding } from "@/lib/hooks/use-workspace";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { errorMessage } from "@/lib/api";

export function OnboardingScreen({ displayName }: { displayName: string }) {
  const userId = useWorkspaceUserId();
  const router = useRouter();
  const { habits } = useHabits(userId);
  const onboarding = useOnboarding(userId);
  const [selected, setSelected] = useState<"defaults" | "scratch" | null>(null);

  const finish = async (mode: "defaults" | "scratch") => {
    setSelected(mode);
    try {
      await onboarding.mutateAsync(mode);
      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error("Could not finish setup", { description: errorMessage(error) });
      setSelected(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-10">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Welcome, {displayName}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          How do you want to start?
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          You can add, edit, archive, or reorder habits at any time. Nothing here is
          permanent.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <Sparkles className="size-6 text-primary" />
            <CardTitle className="text-lg">Start with 25 habits</CardTitle>
            <CardDescription>
              A ready-made starter set. Uncheck anything
              that doesn&apos;t fit later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_HABIT_SEEDS.slice(0, 8).map((habit) => (
                <span
                  key={habit.name}
                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {habit.name}
                </span>
              ))}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                +17 more
              </span>
            </div>
            <Button
              className="w-full"
              disabled={onboarding.isPending || habits.length > 0}
              onClick={() => finish("defaults")}
            >
              {selected === "defaults" ? <Loader2 className="size-4 animate-spin" /> : null}
              Use the starter set
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <SquarePen className="size-6 text-primary" />
            <CardTitle className="text-lg">Start from scratch</CardTitle>
            <CardDescription>
              Begin with an empty grid and add your own habits one by one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-h-[92px] items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              Your grid is waiting
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={onboarding.isPending}
              onClick={() => finish("scratch")}
            >
              {selected === "scratch" ? <Loader2 className="size-4 animate-spin" /> : null}
              Build my own
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
