"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Both icons are rendered on the server and client; CSS chooses which one is
 * visible. This keeps the markup stable during hydration while still reacting
 * to next-themes class changes.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "sm"}
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
      {compact ? null : (
        <>
          <span className="hidden dark:inline">Light</span>
          <span className="dark:hidden">Dark</span>
        </>
      )}
    </Button>
  );
}
