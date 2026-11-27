import type { Metadata } from "next";
import { DiscoveryPanel } from "@/components/discovery/discovery-panel";
import { requireSession } from "@/server/dal/auth-guard";
import { isConfiguredModerator } from "@/server/moderation-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover",
  robots: { index: false, follow: false, nocache: true },
};

export default async function DiscoverPage() {
  const { user } = await requireSession();
  return <DiscoveryPanel canModerate={isConfiguredModerator(user.email)} />;
}
