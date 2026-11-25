import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { sanitizeCallbackUrl } from "@/lib/redirect";
import { getOptionalSession } from "@/server/dal/auth-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const session = await getOptionalSession();
  if (session) redirect("/app");

  const { callbackURL } = await searchParams;
  return <RegisterForm callbackURL={sanitizeCallbackUrl(callbackURL, "/onboarding")} />;
}
