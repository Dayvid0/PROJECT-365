import {
  isModeratorEmail,
  isPublicDiscoveryConfigured,
  type PublicDiscoveryConfig,
} from "@/domain/moderation";

/** Only server code reads these values; they are never sent to the browser. */
export function getPublicDiscoveryConfig(): PublicDiscoveryConfig {
  return {
    moderatorEmails: process.env.MODERATOR_EMAILS ?? "",
    contactEmail: process.env.MODERATOR_CONTACT_EMAIL ?? "",
  };
}

export function isPublicDiscoveryEnabled(): boolean {
  return isPublicDiscoveryConfigured(getPublicDiscoveryConfig());
}

export function isConfiguredModerator(email: string | null | undefined): boolean {
  return isModeratorEmail(email, getPublicDiscoveryConfig().moderatorEmails);
}

/** Public contact address is safe to show; the reviewer allowlist is not. */
export function publicContactEmail(): string | null {
  const contact = getPublicDiscoveryConfig().contactEmail?.trim();
  return isPublicDiscoveryEnabled() && contact ? contact : null;
}
