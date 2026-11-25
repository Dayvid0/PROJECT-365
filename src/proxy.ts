import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeCallbackUrl } from "@/lib/redirect";

/**
 * Fast network-boundary redirect only. Every page and route handler still
 * resolves the live Better Auth session server-side before trusting data.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/app" || pathname.startsWith("/app/") || pathname === "/onboarding") {
    if (!getSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "callbackURL",
        sanitizeCallbackUrl(`${pathname}${search}`)
      );
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/onboarding"],
};
