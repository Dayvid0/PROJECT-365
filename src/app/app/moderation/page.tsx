import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModerationPanel } from "@/components/moderation/moderation-panel";
import { requireSession } from "@/server/dal/auth-guard";
import { isConfiguredModerator } from "@/server/moderation-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Moderation",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ModerationPage() {
  const { user } = await requireSession();
  if (!isConfiguredModerator(user.email)) redirect("/app/discover");
  return <ModerationPanel moderatorId={user.id} />;
}
