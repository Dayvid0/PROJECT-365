"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { DaymarkMark } from "@/components/brand/daymark-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

const NAV_LINKS = [
  { href: "#practice", label: "The practice" },
  { href: "#ritual", label: "Daily ritual" },
  { href: "#progress", label: "Progress" },
  { href: "#community", label: "Community" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={cn(styles.navInner, styles.sectionWrap)}>
        <Link href="/" className={styles.brand} aria-label="Daymark home">
          <DaymarkMark className="size-8" />
          <span>daymark</span>
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="landing-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>

        <nav
          id="landing-navigation"
          className={cn(styles.nav, open && styles.navOpen)}
          aria-label="Main navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.navLink}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <div className={styles.navActions}>
            <Button asChild size="sm" className="h-9 px-3 text-xs">
              <Link href="/register" onClick={() => setOpen(false)}>
                Get started
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-9 px-3 text-xs"
            >
              <Link href="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            </Button>
            <ThemeToggle compact />
          </div>
        </nav>
      </div>
    </header>
  );
}
