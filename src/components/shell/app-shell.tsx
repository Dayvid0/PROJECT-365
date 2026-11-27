"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck2,
  ChevronRight,
  CloudOff,
  Compass,
  Grid3X3,
  HeartHandshake,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DaymarkMark } from "@/components/brand/daymark-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useBootstrap, useOnlineStatus } from "@/lib/hooks/use-workspace";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import styles from "./app-shell.module.css";

const NAV = [
  { href: "/app/today", label: "Today", icon: CalendarCheck2 },
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/grid", label: "Grid", icon: Grid3X3 },
  { href: "/app/habits", label: "Habits", icon: ListChecks },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/accountability", label: "Accountability", icon: HeartHandshake },
  { href: "/app/circles", label: "Circles", icon: Users },
  { href: "/app/discover", label: "Discover", icon: Compass },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

type NavItem = (typeof NAV)[number] | {
  href: "/app/moderation";
  label: "Moderation";
  icon: typeof ShieldCheck;
};

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
  const desktopNav: readonly NavItem[] = canModerate
    ? [
        ...navItems,
        { href: "/app/moderation", label: "Moderation", icon: ShieldCheck },
      ]
    : navItems;
  const displayNameNow = bootstrap?.user?.name ?? displayName;
  const initial = (displayNameNow.trim()[0] ?? "D").toUpperCase();
  const checkInLabel = `${pendingCount} check-in${pendingCount === 1 ? "" : "s"}`;
  const syncStatus = !isOnline
    ? pendingCount > 0
      ? `Offline — ${checkInLabel} saved on this device. Other changes need a connection.`
      : "Offline — check-ins will save on this device. Other changes need a connection."
    : pendingCount > 0
      ? `Back online — ${checkInLabel} still waiting to sync. Other changes save only while connected.`
      : "Online — check-ins sync automatically. Other changes save only while connected.";

  function isActive(href: string) {
    return href === "/app" ? pathname === href : pathname.startsWith(href);
  }

  const currentLabel =
    desktopNav.find((item) => isActive(item.href))?.label ?? "Workspace";
  const sidebarStatus = !isOnline
    ? pendingCount > 0
      ? `Offline · ${pendingCount} pending`
      : "Offline · saved locally"
    : pendingCount > 0
      ? `Back online · ${pendingCount} pending`
      : "Online · synced";

  return (
    <div className={styles.shell}>
      <a
        href="#main-content"
        className={styles.skipLink}
      >
        Skip to main content
      </a>

      <aside className={styles.sidebar}>
        <Link href="/app" className={styles.brand}>
          <span className={styles.brandMark}>
            <DaymarkMark />
          </span>
          <span>{APP_NAME}</span>
        </Link>

        <div className={styles.workspace}>
          <span className={styles.workspaceAvatar} aria-hidden="true">
            {initial}
          </span>
          <span className={styles.workspaceCopy}>
            <span className="sr-only">Signed in as</span>
            <strong>{displayNameNow}</strong>
            <small>Your workspace</small>
          </span>
        </div>

        <div className={styles.navLabel}>Your space</div>
        <nav className={styles.nav} aria-label="Main navigation">
          {desktopNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(styles.navLink, active && styles.navLinkActive)}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarStatus} aria-hidden="true">
            <span
              className={cn(
                styles.statusDot,
                (!isOnline || pendingCount > 0) && styles.statusDotAttention
              )}
            />
            {sidebarStatus}
          </div>
          <Button variant="outline" className={styles.signOut} onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className={styles.column}>
        <header className={styles.topbar}>
          <div className={styles.topbarLead}>
            <div className={styles.mobileBrand}>
              <DaymarkMark />
              {APP_NAME}
            </div>
            <div className={styles.breadcrumb}>
              <span>My practice</span>
              <ChevronRight className="size-3" aria-hidden="true" />
              <strong>{currentLabel}</strong>
            </div>
          </div>

          <div
            aria-live="polite"
            aria-atomic="true"
            className={styles.syncText}
          >
            {syncStatus}
            {pendingCount > 0 ? (
              <Link href="/app/settings" className={styles.syncLink}>
                Review pending changes
              </Link>
            ) : null}
          </div>

          <div className={styles.topbarActions}>
            {pendingCount > 0 ? (
              <Link
                href="/app/settings"
                aria-label={`${checkInLabel} waiting to sync. Review in Settings.`}
                className={cn(styles.statusPill, styles.pendingPill)}
              >
                <CloudOff className="size-3" />
                {pendingCount} pending
              </Link>
            ) : !isOnline ? (
              <span className={styles.statusPill}>
                <CloudOff className="size-3" />
                Offline
              </span>
            ) : null}
            <span className={styles.topAvatar} aria-hidden="true">
              {initial}
            </span>
            <div className={styles.themeControl}>
              <ThemeToggle compact />
            </div>
            <div className={styles.mobileSignOut}>
              <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className={styles.content}>
          {children}
        </main>
      </div>

      <nav
        className={styles.mobileNav}
        aria-label="Mobile navigation"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(styles.mobileNavLink, active && styles.mobileNavLinkActive)}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
