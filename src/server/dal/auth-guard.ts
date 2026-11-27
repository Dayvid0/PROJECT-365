import { headers } from "next/headers";
import { auth, type BetterAuthSession } from "@/server/auth";
import { isConfiguredModerator } from "@/server/moderation-config";
import { ForbiddenError, UnauthorizedError } from "./errors";

export interface AuthenticatedContext {
  session: BetterAuthSession["session"];
  user: BetterAuthSession["user"];
}

export interface SessionResolver {
  getSession(): Promise<BetterAuthSession | null>;
}

const defaultSessionResolver: SessionResolver = {
  async getSession() {
    return auth.api.getSession({ headers: await headers() });
  },
};

export async function getOptionalSession(
  resolver: SessionResolver = defaultSessionResolver
): Promise<AuthenticatedContext | null> {
  const result = await resolver.getSession();
  if (!result?.session || !result.user) return null;
  return { session: result.session, user: result.user };
}

/** Defence-in-depth guard used by every page loader, route handler, and DAL call. */
export async function requireSession(
  resolver: SessionResolver = defaultSessionResolver
): Promise<AuthenticatedContext> {
  const context = await getOptionalSession(resolver);
  if (!context) throw new UnauthorizedError();
  return context;
}

/** Moderation is an environment allowlist, never a self-assigned profile flag. */
export async function requireModerator(
  resolver: SessionResolver = defaultSessionResolver
): Promise<AuthenticatedContext> {
  const context = await requireSession(resolver);
  if (!isConfiguredModerator(context.user.email)) {
    throw new ForbiddenError("Moderator access is not available for this account.");
  }
  return context;
}
