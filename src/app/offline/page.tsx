import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border bg-card shadow-none">
        <CardHeader className="text-center">
          <WifiOff className="mx-auto size-8 text-muted-foreground" />
          <CardTitle>You&apos;re offline</CardTitle>
          <CardDescription>
            {APP_NAME} will reconnect when your network is back. Any habit changes you make
            are saved locally first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="outline">
            <Link href="/app">Try again</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
