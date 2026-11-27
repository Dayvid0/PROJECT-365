"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  CloudOff,
  Compass,
  Grid3X3,
  HeartHandshake,
  ListChecks,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useBootstrap, useOnlineStatus } from "@/lib/hooks/use-workspace";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app/today", label: "Today", icon: CalendarCheck2 },
  { href: "/app", label: "Dashboard", icon: CalendarCheck2 },
  { href: "/app/grid", label: "Grid", icon: Grid3X3 },
  { href: "/app/habits", label: "Habits", icon: ListChecks },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/accountability", label: "Accountability", icon: HeartHandshake },
  { href: "/app/circles", label: "Circles", icon: Users },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  displayName,
  discoveryEnabled,
  canModerate,
  children,
}: {
  displayName: string;
  discoveryEnabled: boolean;
  canModerate: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const signOut = useSignOut();
  const isOnline = useOnlineStatus();
  const pendingCount = useWorkspaceUIStore((state) => state.pendingLogs.length);
  const navItems = discoveryEnabled
    ? NAV
    : NAV.filter((item) => item.href !== "/app/discover");
  const desktopNav = canModerate
    ? [
        ...navItems,
        { href: "/app/moderation", label: "Moderation", icon: ShieldCheck },
      ]
    : navItems;
  const displayNameNow = bootstrap?.user?.name ?? displayName;
  const checkInLabel = `${pendingCount} check-in${pendingCount === 1 ? "" : "s"}`;
  const syncStatus = !isOnline
    ? pendingCount > 0
      ? `Offline — ${checkInLabel} saved on this device. Other changes need a connection.`
      : "Offline — check-ins will save on this device. Other changes need a connection."
    : pendingCount > 0
      ? `Back online — ${checkInLabel} still waiting to sync. Other changes save only while connected.`
      : "Online — check-ins sync automatically. Other changes save only while connected.";

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-card px-3 py-5 md:flex">
        <Link href="/app" className="mb-8 flex items-center gap-2 px-2 text-sm font-bold">
          <CalendarCheck2 className="size-5 text-primary" />
          PROJECT_365
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Main navigation">
          {desktopNav.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="px-2 text-xs text-muted-foreground">Signed in as</div>
          <div className="truncate px-2 text-sm font-medium">{displayNameNow}</div>
          <Button variant="outline" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="md:pl-56">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 text-sm font-bold md:hidden">
            <CalendarCheck2 className="size-5 text-primary" />
            PROJECT_365
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only text-xs text-muted-foreground md:not-sr-only"
          >
            {syncStatus}
            {pendingCount > 0 ? (
              <Link href="/app/settings" className="ml-1 underline underline-offset-2">
                Review pending changes
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 ? (
              <Link
                href="/app/settings"
                aria-label={`${checkInLabel} waiting to sync. Review in Settings.`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <CloudOff className="size-3" />
                {pendingCount} pending
              </Link>
            ) : !isOnline ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <CloudOff className="size-3" />
                Offline
              </span>
            ) : null}
            <ThemeToggle compact />
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Sign out" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card px-2 py-2 md:hidden"
        aria-label="Mobile navigation"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/app" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md py-1 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
