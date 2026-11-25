import { DEFAULT_AUTHENTICATED_PATH } from "./constants";

const AUTH_ROUTE_PREFIXES = ["/login", "/register"];

/** Strict same-origin relative-path sanitizer for `callbackURL` parameters. */
export function sanitizeCallbackUrl(
  rawUrl: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH
): string {
  if (typeof rawUrl !== "string") return fallback;

  const trimmed = rawUrl.trim();
  if (!trimmed || !trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
  if (/^\/%(?:2f|5c)/i.test(trimmed)) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "https://project365.invalid");
  } catch {
    return fallback;
  }
  if (parsed.origin !== "https://project365.invalid") return fallback;

  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (
    AUTH_ROUTE_PREFIXES.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`)
    )
  ) {
    return fallback;
  }
  return normalized;
}
