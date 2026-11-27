import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy details",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Privacy details</h1>
        <p className="text-sm text-muted-foreground">
          A plain-language account of what Daymark stores, syncs, and shares.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>What is stored</CardTitle>
          <CardDescription>Your workspace belongs to your signed-in account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            We store your name, email, timezone, and preferences. We also store the habits you
            create, their schedules and planned breaks, your check-ins and their optional notes,
            per-habit reminder times, and private weekly reflections. Trend snapshots are derived
            from that history and stored with it.
          </p>
          <p>
            If you use accountability, we also store invites, the connections you accept, the exact
            fields you choose to share, and any block, mute, or report records you create. Circles
            add their names, purposes, memberships, exact-email invitations, supportive reactions,
            replies, circle-local challenges, and challenge participation. None of this is created
            without an action you take.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Where it lives</CardTitle>
          <CardDescription>A server database for your account, plus a small local queue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Workspace data lives in this app&apos;s server database and is returned only to your
            signed-in account. A session cookie keeps you signed in. The only workspace data kept in
            this browser is a short queue of check-ins that failed to save; it is cleared when you
            sign out and never contains your password.
          </p>
          <p>
            The service worker caches public assets such as icons and the offline page. It never
            caches private app pages or API responses.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Sync and offline</CardTitle>
          <CardDescription>Only check-ins are queued offline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            If a check-in cannot reach the server, it waits on this device and retries when the
            connection returns. Other changes — habits, schedules, settings, invites, and sharing —
            are not queued. They need a working connection and show an error if they fail.
          </p>
          <p>
            Waiting check-ins are not in your export until they sync. A full restore discards them
            because their habit IDs no longer match. The header shows how many are waiting and links
            to Settings, where you can review or discard them.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Sharing</CardTitle>
          <CardDescription>Private by default, always.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Nothing is shared unless you invite someone by their exact email address and they
            accept the invite as that signed-in account. Before you confirm any shared field, you
            see a preview of exactly what the other person or circle would get. You can revoke a
            grant at any time, and you can block, mute, report, or leave a connection. Joining a
            circle shares nothing by itself; only your active, circle-scoped grants are visible to
            current members.
          </p>
          <p>
            Within a circle, members can send anonymous supportive reactions and written replies on
            updates that are still visible through an active grant. They can also start and join
            private challenges; only the participant count is shown, never names, progress, or a
            ranking. These interactions are visible only to current members of that circle.
            Separate public challenges can be proposed, but they stay hidden until an allowlisted
            moderator approves them. Discovery is signed-in only and shows just a title, summary,
            dates, and an aggregate participant count. There are no public profiles, no user search,
            no direct messages, and no leaderboards. Joining a public challenge shares no habit
            data; you can hide, report, or leave it at any time.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Notes and weekly reviews</CardTitle>
          <CardDescription>Your reflections stay yours.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Weekly reflections are private and never included in any share grant. Check-in notes
            are included only if you explicitly select the note field in a previewed grant; they
            are otherwise private. Both are included in your own JSON backup.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Reminders</CardTitle>
          <CardDescription>Honest in-app nudges, not push notifications.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Reminders appear only while this tab is open. We do not send push notifications and we
            never ask for operating-system notification permission. Quiet hours are respected, and
            snooze or dismiss applies only for your current visit — nothing is delivered later.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Analytics and telemetry</CardTitle>
          <CardDescription>No third-party tracking is built into this app.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            The charts you see are calculated from your own data. This app does not include
            third-party analytics, advertising, or crash-reporting tools, and it does not send
            usage telemetry from your browser.
          </p>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Export, restore, and account removal</CardTitle>
          <CardDescription>You can take a full copy of your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Settings offers a CSV of habits and logs and a JSON backup containing your profile
            settings, habits, schedules, exceptions, check-ins, reminders, and private weekly notes.
            Restoring a JSON backup replaces the current workspace in one transaction.
          </p>
          <p>
            Settings has a permanent Delete account action. After you type your account email to
            confirm, it removes your profile, sessions, preferences, habits, schedules, check-ins,
            notes, reminders, weekly reflections, sharing grants, circles you own, memberships,
            invites, reactions, comments, challenges, challenge participation, public challenge
            proposals you own, public challenge participation, hidden challenges, and safety records
            in one transaction. Approved public challenges you proposed remain without your account
            reference. Your sign-in cookies are cleared as part of that request.
          </p>
          <p>
            Export a JSON backup first if you want a copy. Deletion is immediate and cannot be
            undone. No separate retention schedule applies beyond the data listed above.
          </p>
          <Button variant="outline" asChild>
            <Link href="/app/settings">Back to Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
