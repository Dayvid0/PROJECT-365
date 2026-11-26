import type {
  Habit,
  HabitLog,
  HabitStatus,
  PartnerInvite,
  ShareAudience,
  ShareField,
  ShareGrant,
  SharePreview,
  SharePreviewField,
  ShareFrequency,
} from "./types";

export const REVOCATION_NOTICE =
  "Revoking stops future sharing. Anything already seen may remain in the recipient’s history or notes; ask them to delete it if needed.";

const FIELD_LABELS: Record<ShareField, string> = {
  name: "Habit name",
  alias: "Alias",
  status: "Latest check-in",
  quantity: "Quantity",
  note: "Note",
  history: "Progress history",
};

const FREQUENCY_LABELS: Record<ShareFrequency, string> = {
  every_check_in: "Every check-in",
  weekly_summary: "Weekly summary",
  milestone_only: "Milestones only",
  none: "No automatic sharing",
};

const STATUS_LABELS: Record<HabitStatus, string> = {
  1: "Complete",
  0.5: "Partial progress",
  0: "Not yet complete",
};

export function isGrantActive(grant: ShareGrant, now: Date = new Date()): boolean {
  if (grant.revokedAt) return false;
  if (new Date(grant.startsAt) > now) return false;
  return !grant.endsAt || new Date(grant.endsAt) > now;
}

/** Every shared projection must start from this allow-list, never the raw habit. */
export function shareableFields(grant: ShareGrant, now: Date = new Date()): ShareField[] {
  return isGrantActive(grant, now) ? [...grant.fields] : [];
}

export function revokeGrant(grant: ShareGrant, now: Date = new Date()): ShareGrant {
  const timestamp = now.toISOString();
  return { ...grant, revokedAt: timestamp, updatedAt: timestamp };
}

/**
 * Invites are bound to an exact email address and a single signed-in account.
 * This keeps partner connections out of public discovery and prevents a
 * forwarded link from connecting the wrong account.
 */
export function canAcceptPartnerInvite(
  invite: PartnerInvite,
  viewer: { id: string; email: string },
  now: Date = new Date()
): boolean {
  if (invite.status !== "pending") return false;
  if (invite.inviteeEmail.trim().toLowerCase() !== viewer.email.trim().toLowerCase()) {
    return false;
  }
  if (invite.inviteeId && invite.inviteeId !== viewer.id) return false;
  return new Date(invite.expiresAt) > now;
}

export function isSafetyControlActive(
  control: { expiresAt: string | Date | null },
  now: Date = new Date()
): boolean {
  return !control.expiresAt || new Date(control.expiresAt) > now;
}

function audienceLabel(audience: ShareAudience): string {
  return audience === "partner" ? "a trusted partner" : "an invite-only circle";
}

export function buildSharePreview({
  grant,
  habit,
  latestLog,
}: {
  grant: ShareGrant;
  habit: Habit;
  latestLog?: HabitLog;
}): SharePreview {
  const status =
    latestLog === undefined
      ? "No check-in shared yet"
      : STATUS_LABELS[latestLog.status];
  const quantity =
    latestLog?.value === null || latestLog?.value === undefined
      ? "No quantity shared yet"
      : `${latestLog.value}${latestLog.unit ? ` ${latestLog.unit}` : ""}`;
  const values: Record<ShareField, string> = {
    name: habit.name,
    alias: grant.alias ?? habit.name,
    status,
    quantity,
    note: latestLog?.note || "No note shared",
    history: "Calendar and trend for this habit only, without private notes",
  };

  const fields: SharePreviewField[] = shareableFields(grant).map((field) => ({
    field,
    label: FIELD_LABELS[field],
    value: values[field],
  }));

  return {
    grantId: grant.id,
    audience: grant.audience,
    audienceLabel:
      grant.audience === "partner" ? "Trusted partner" : "Invite-only circle",
    frequency: grant.frequency,
    frequencyLabel: FREQUENCY_LABELS[grant.frequency],
    fields,
    revocationNotice: REVOCATION_NOTICE,
  };
}

/** Kept for callers that want a generic audience phrase in consent copy. */
export function shareAudiencePhrase(audience: ShareAudience): string {
  return audienceLabel(audience);
}
