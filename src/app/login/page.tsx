import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { sanitizeCallbackUrl } from "@/lib/redirect";
import { getOptionalSession } from "@/server/dal/auth-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const session = await getOptionalSession();
  if (session) redirect("/app");

  const { callbackURL } = await searchParams;
  return (
    <AuthShell mode="signin">
      <LoginForm callbackURL={sanitizeCallbackUrl(callbackURL)} />
    </AuthShell>
  );
}
