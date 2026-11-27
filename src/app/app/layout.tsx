import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceQueryProvider } from "@/components/providers/query-provider";
import { WorkspaceProvider } from "@/components/providers/workspace-context";
import { AppShell } from "@/components/shell/app-shell";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";
import { isConfiguredModerator, isPublicDiscoveryEnabled } from "@/server/moderation-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user } = await requireSession();
  const profile = await workspaceRepository.getProfile(user.id);
  if (!profile.onboardingCompleted) redirect("/onboarding");

  return (
    <WorkspaceProvider userId={user.id}>
      <WorkspaceQueryProvider>
        <AppShell
          displayName={profile.name}
          discoveryEnabled={isPublicDiscoveryEnabled()}
          canModerate={isConfiguredModerator(user.email)}
        >
          {children}
        </AppShell>
      </WorkspaceQueryProvider>
    </WorkspaceProvider>
  );
}
