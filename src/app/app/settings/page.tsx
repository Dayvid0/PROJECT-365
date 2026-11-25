"use client";

import { useState, type FormEvent } from "react";
import { BellOff, Download, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
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
import { APP_NAME } from "@/lib/constants";
import { useBootstrap, useUpdateProfile } from "@/lib/hooks/use-workspace";
import { useSignOut } from "@/lib/hooks/use-sign-out";

export default function SettingsPage() {
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const user = bootstrap?.user;
  const updateProfile = useUpdateProfile(userId);
  const signOut = useSignOut();
  const [draft, setDraft] = useState<{ name: string; timezone: string } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  // Derived from the query result; no effect needed to sync server state into the form.
  const name = draft?.name ?? user?.name ?? "";
  const timezone = draft?.timezone ?? user?.timezone ?? "UTC";

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await updateProfile.mutateAsync({ name: name.trim(), timezone: timezone.trim() || "UTC" });
      setDraft(null);
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Profile, appearance, and your data.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user?.email ?? "…"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" value={name} maxLength={120} onChange={(event) => setDraft({ name: event.target.value, timezone })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input id="timezone" value={timezone} maxLength={120} onChange={(event) => setDraft({ name, timezone: event.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Dark by default; switch any time.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm">Theme</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="size-4 text-muted-foreground" /> Notifications
          </CardTitle>
          <CardDescription>
            Push reminders are not available on the web. Your {user?.notificationTime ?? "08:00"}
            {" "}reminder preference is still saved for future use.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Download all habit history as a spreadsheet-friendly file.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" asChild>
            <a href="/api/workspace/export" download>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">
            Includes every logged date, status, category, and timestamp.
          </span>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-between text-sm text-muted-foreground">
          <span>{APP_NAME}</span>
          <span>Web · version 1.0.0</span>
        </CardContent>
      </Card>

      <Card className="border-destructive/40 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="size-4" /> Sign out
          </CardTitle>
          <CardDescription>
            Pending offline changes are cleared when you sign out, so they can never appear in
            another account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmSignOut ? (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={signOut}>Yes, sign me out</Button>
              <Button variant="outline" onClick={() => setConfirmSignOut(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmSignOut(true)}>Sign out</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
