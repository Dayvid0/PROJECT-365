import { redirect } from "next/navigation";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { WorkspaceProvider } from "@/components/providers/workspace-context";
import { WorkspaceQueryProvider } from "@/components/providers/query-provider";
import { requireSession } from "@/server/dal/auth-guard";
import { workspaceRepository } from "@/server/dal/workspace-repository";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { user } = await requireSession();
  const profile = await workspaceRepository.getProfile(user.id);
  if (profile.onboardingCompleted) redirect("/app");

  return (
    <WorkspaceProvider userId={user.id}>
      <WorkspaceQueryProvider>
        <OnboardingScreen displayName={profile.name} />
      </WorkspaceQueryProvider>
    </WorkspaceProvider>
  );
}
