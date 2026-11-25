import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-bold">
          <CalendarCheck2 className="size-5 text-primary" />
          {APP_NAME}
        </Link>
        <ThemeToggle compact />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
