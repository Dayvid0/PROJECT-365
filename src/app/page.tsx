import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { getOptionalSession } from "@/server/dal/auth-guard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOptionalSession();
  if (session) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-8">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <CalendarCheck2 className="size-5 text-primary" />
          {APP_NAME}
        </div>
        <ThemeToggle compact />
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            One habit at a time
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
            Show up every day.
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground md:text-lg">
            Track habits on a 365-day grid, see your streaks, and understand what
            is working. Private by default, works offline, and lives in your browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">
              Start tracking <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="grid w-full gap-3 pt-6 text-left sm:grid-cols-3">
          {[
            ["Daily grid", "Tap through done, partial, and missed in one place."],
            ["Real analytics", "Monthly snapshots, weekly averages, and streaks."],
            ["Offline first", "Changes queue locally and sync when you reconnect."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
