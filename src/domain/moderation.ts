import type { PublicChallengeStatus, SafetyReportStatus } from "./types";

/**
 * Public discovery is gated by staffed moderation, not just an opt-in flag.
 * Both an allowlist and a visible contact address must be configured before
 * any proposal can be approved or shown to other signed-in users.
 */

export const PUBLIC_CHALLENGE_POLICY_VERSION = "2026-11";

export interface PublicDiscoveryConfig {
  moderatorEmails?: string | null;
  contactEmail?: string | null;
}

export interface PublicChallengeWindow {
  status: PublicChallengeStatus;
  endsAt: string | Date;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseModeratorEmails(value: string | null | undefined): string[] {
  if (!value) return [];
  const emails = value
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter((email) => email.length > 0);
  return Array.from(new Set(emails));
}

export function isModeratorEmail(
  email: string | null | undefined,
  moderatorEmails: string | null | undefined
): boolean {
  if (!email) return false;
  return parseModeratorEmails(moderatorEmails).includes(normalizeEmail(email));
}

export function isPublicDiscoveryConfigured(config: PublicDiscoveryConfig): boolean {
  const contact = normalizeEmail(config.contactEmail ?? "");
  return (
    parseModeratorEmails(config.moderatorEmails).length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
  );
}

export function canTransitionSafetyReportStatus(
  from: SafetyReportStatus,
  to: SafetyReportStatus
): boolean {
  if (from === to) return false;
  if (from === "open") return to === "reviewing" || to === "resolved" || to === "dismissed";
  if (from === "reviewing") return to === "resolved" || to === "dismissed";
  return false;
}

export function canTransitionPublicChallengeStatus(
  from: PublicChallengeStatus,
  to: PublicChallengeStatus
): boolean {
  if (from === to) return false;
  if (from === "proposed") return to === "active" || to === "rejected";
  if (from === "active") return to === "retired";
  return false;
}

export function isPublicChallengeVisible(status: PublicChallengeStatus): boolean {
  return status === "active";
}

/** Joining is opt-in, one-step, and never exposes private habit data. */
export function canJoinPublicChallenge(
  challenge: PublicChallengeWindow,
  now: Date = new Date()
): boolean {
  return isPublicChallengeVisible(challenge.status) && new Date(challenge.endsAt) > now;
}
