"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, LogOut, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWorkspaceUserId } from "@/components/providers/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { workspaceBackupSchema } from "@/domain/backup";
import type { StreakPolicy } from "@/domain/types";
import { APP_NAME, STREAK_POLICIES } from "@/lib/constants";
import { errorMessage } from "@/lib/api";
import {
  useBootstrap,
  useRestoreBackup,
  useUpdatePreferences,
  useUpdateProfile,
} from "@/lib/hooks/use-workspace";
import { useDeleteAccount } from "@/lib/hooks/use-delete-account";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

interface ReminderPrefsDraft {
  enabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export default function SettingsPage() {
  const userId = useWorkspaceUserId();
  const { data: bootstrap } = useBootstrap(userId);
  const user = bootstrap?.user;
  const updateProfile = useUpdateProfile(userId);
  const updatePreferences = useUpdatePreferences(userId);
  const restoreBackup = useRestoreBackup(userId);
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  const pendingCount = useWorkspaceUIStore((state) => state.pendingLogs.length);
  const [draft, setDraft] = useState<{ name: string; timezone: string } | null>(null);
  const [streakDraft, setStreakDraft] = useState<StreakPolicy | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderPrefsDraft | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  // Derived from the query result; no effect needed to sync server state into the form.
  const name = draft?.name ?? user?.name ?? "";
  const timezone = draft?.timezone ?? user?.timezone ?? "UTC";
  const streakPolicy = streakDraft ?? user?.streakPolicy ?? "strict";
  const remindersEnabled = reminderDraft?.enabled ?? user?.remindersEnabled ?? false;
  const quietHoursStart = reminderDraft?.quietHoursStart ?? user?.quietHoursStart ?? "22:00";
  const quietHoursEnd = reminderDraft?.quietHoursEnd ?? user?.quietHoursEnd ?? "07:00";
  const deleteMatches =
    deleteConfirmation.trim().toLowerCase() === (user?.email ?? "").toLowerCase();
  const preferencesPending = updatePreferences.isPending;

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

  const savePreferences = async () => {
    try {
      await updatePreferences.mutateAsync({
        streakPolicy,
        remindersEnabled,
        quietHoursStart,
        quietHoursEnd,
      });
      setStreakDraft(null);
      setReminderDraft(null);
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  const restore = async () => {
    if (!restoreFile) return;
    try {
      const parsed = workspaceBackupSchema.parse(JSON.parse(await restoreFile.text()));
      await restoreBackup.mutateAsync(parsed);
      setRestoreError(null);
      setRestoreFile(null);
      setConfirmRestore(false);
    } catch (error) {
      const message = errorMessage(error);
      setRestoreError(message);
      toast.error("Could not restore backup", { description: message });
    }
  };

  const discardPending = () => {
    useWorkspaceUIStore.getState().clearPending();
    setConfirmDiscard(false);
    toast.success("Pending changes discarded");
  };

  const removeAccount = async () => {
    if (!deleteMatches) return;
    try {
      await deleteAccount.mutateAsync(deleteConfirmation.trim());
    } catch {
      // Toast handled by the mutation hook.
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, progress style, reminders, and your data.
        </p>
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
                <Input
                  id="display-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setDraft({ name: event.target.value, timezone })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={timezone}
                  maxLength={120}
                  onChange={(event) => setDraft({ name, timezone: event.target.value })}
                />
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
          <CardTitle>Progress style</CardTitle>
          <CardDescription>
            Choose how streaks are shown. History is kept either way.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="streak-policy">Streaks</Label>
            <Select
              value={streakPolicy}
              onValueChange={(value) => setStreakDraft(value as StreakPolicy)}
            >
              <SelectTrigger id="streak-policy" className="min-h-11 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STREAK_POLICIES.map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {policy === "strict"
                      ? "Strict — consecutive scheduled days"
                      : policy === "target"
                        ? "Gentle — recent consistency"
                        : "Hidden — keep history, hide streaks"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hidden streaks do not remove any check-ins. Skips and planned breaks never break a
              streak.
            </p>
          </div>
          <Button onClick={() => void savePreferences()} disabled={preferencesPending}>
            Save progress style
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            In-app reminders only work while this tab is open. No push notifications are sent and
            no OS permission is needed. Quiet hours are enforced here; snooze and dismiss last for
            the current visit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="reminders-enabled">
              <span className="block text-sm">Enable local reminders</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Per-habit times are set on each habit page.
              </span>
            </Label>
            <Switch
              id="reminders-enabled"
              checked={remindersEnabled}
              onCheckedChange={(enabled) =>
                setReminderDraft({
                  enabled,
                  quietHoursStart,
                  quietHoursEnd,
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiet-start">Quiet hours start</Label>
              <Input
                id="quiet-start"
                type="time"
                className="min-h-11"
                value={quietHoursStart}
                onChange={(event) =>
                  setReminderDraft({
                    enabled: remindersEnabled,
                    quietHoursStart: event.target.value,
                    quietHoursEnd,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-end">Quiet hours end</Label>
              <Input
                id="quiet-end"
                type="time"
                className="min-h-11"
                value={quietHoursEnd}
                onChange={(event) =>
                  setReminderDraft({
                    enabled: remindersEnabled,
                    quietHoursStart,
                    quietHoursEnd: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <Button onClick={() => void savePreferences()} disabled={preferencesPending}>
            Save reminders
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>
            Export a CSV of habits or a full JSON backup you can restore later. The JSON backup
            includes schedules, skips, reminders, reminder settings, and private weekly notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" asChild>
              <a href="/api/workspace/export" download>
                <Download className="size-4" /> Export CSV
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/workspace/export?format=json" download>
                <Download className="size-4" /> Export JSON backup
              </a>
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="backup-file">Restore a JSON backup</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                key={restoreFile ? "backup-selected" : "backup-empty"}
                id="backup-file"
                type="file"
                accept="application/json,.json"
                className="min-h-11 max-w-xs"
                onChange={(event) => {
                  setRestoreError(null);
                  setRestoreFile(event.target.files?.[0] ?? null);
                }}
              />
              <Button
                variant="outline"
                disabled={!restoreFile || restoreBackup.isPending}
                onClick={() => setConfirmRestore(true)}
              >
                <Upload className="size-4" /> Restore
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A full restore replaces every habit, schedule, log, reminder, preference, and private
              weekly note in this account.
            </p>
          </div>
          {pendingCount > 0 ? (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {pendingCount} offline change{pendingCount === 1 ? "" : "s"} still waiting to sync.
                Exports do not include them yet, and a restore will discard them.
              </p>
              <Button variant="outline" size="sm" onClick={() => setConfirmDiscard(true)}>
                Discard pending changes
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Accountability</CardTitle>
          <CardDescription>
            Partner invites, field-level sharing, revocation, and safety controls live on their own
            page. Nothing is shared unless you explicitly confirm it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/app/accountability">Manage accountability</a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            What is stored, what syncs offline, how sharing works, and what exports include — in
            plain language.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/app/privacy">Read privacy details</Link>
          </Button>
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

      <Card className="border-destructive/40 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" /> Delete account
          </CardTitle>
          <CardDescription>
            Permanently removes your profile, sessions, preferences, habits, schedules, check-ins,
            notes, reminders, weekly reflections, and sharing records. Export a JSON backup first if
            you want a copy. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmDelete ? (
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type {user?.email ?? "your account email"} to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                maxLength={320}
                autoComplete="off"
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={!deleteMatches || deleteAccount.isPending}
                  onClick={() => void removeAccount()}
                >
                  Permanently delete account
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteConfirmation("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your workspace?</DialogTitle>
            <DialogDescription>
              This deletes your current habits, schedules, logs, reminders, preferences, and private
              weekly notes, then restores the uploaded file. Export a fresh JSON backup first if you
              want a safety copy. This cannot be undone.
              {pendingCount > 0
                ? ` ${pendingCount} offline change${pendingCount === 1 ? "" : "s"} will also be discarded.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {restoreError ? (
            <p role="alert" className="text-xs text-destructive">{restoreError}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={restoreBackup.isPending}
              onClick={() => void restore()}
            >
              Replace my workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard pending changes?</DialogTitle>
            <DialogDescription>
              The {pendingCount} check-in{pendingCount === 1 ? "" : "s"} waiting on this device will
              be removed. Saved server data is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>Cancel</Button>
            <Button variant="destructive" onClick={discardPending}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
