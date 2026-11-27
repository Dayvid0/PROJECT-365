import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing-page";
import { getOptionalSession } from "@/server/dal/auth-guard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getOptionalSession();
  if (session) redirect("/app");

  return <LandingPage />;
}
