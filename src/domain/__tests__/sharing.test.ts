import { describe, expect, it } from "vitest";
import {
  buildSharePreview,
  canAcceptPartnerInvite,
  isGrantActive,
  isSafetyControlActive,
  revokeGrant,
  shareableFields,
} from "../sharing";
import type { Habit, PartnerInvite, SafetyControl, ShareGrant } from "../types";

const now = new Date("2026-03-03T12:00:00.000Z");

const habit: Habit = {
  id: "habit-1",
  name: "Read",
  description: null,
  category: "learning",
  order: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  color: "#22c55e",
  kind: "check_in",
  targetValue: null,
  unit: null,
  targetDurationSeconds: null,
};

function grant(overrides: Partial<ShareGrant> = {}): ShareGrant {
  return {
    id: "grant-1",
    ownerId: "owner-1",
    audience: "partner",
    recipientId: "partner-1",
    circleId: null,
    habitId: habit.id,
    alias: "Evening reading",
    fields: ["alias", "status", "note"],
    frequency: "weekly_summary",
    consentVersion: 1,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("consent-based sharing", () => {
  it("only exposes fields from an active grant", () => {
    const active = grant();
    expect(isGrantActive(active, now)).toBe(true);
    expect(shareableFields(active, now)).toEqual(["alias", "status", "note"]);

    const expired = grant({ endsAt: "2026-03-01T00:00:00.000Z" });
    expect(isGrantActive(expired, now)).toBe(false);
    expect(shareableFields(expired, now)).toEqual([]);
  });

  it("stops all fields when a grant is revoked", () => {
    const revoked = revokeGrant(grant(), now);
    expect(revoked.revokedAt).toBe(now.toISOString());
    expect(isGrantActive(revoked, now)).toBe(false);
    expect(shareableFields(revoked, now)).toEqual([]);

    const preview = buildSharePreview({ grant: revoked, habit });
    expect(preview.fields).toEqual([]);
    expect(preview.revocationNotice).toContain("Revoking stops future sharing");
  });

  it("previews only granted fields and explains retained content", () => {
    const preview = buildSharePreview({
      grant: grant(),
      habit,
      latestLog: {
        habitId: habit.id,
        date: "2026-03-03",
        status: 1,
        updatedAt: "2026-03-03T08:00:00.000Z",
        value: 30,
        unit: "minutes",
        note: "Felt calm afterwards",
      },
    });

    expect(preview.fields.map((field) => field.field)).toEqual([
      "alias",
      "status",
      "note",
    ]);
    expect(preview.fields.find((field) => field.field === "alias")?.value).toBe(
      "Evening reading"
    );
    expect(preview.fields.find((field) => field.field === "note")?.value).toBe(
      "Felt calm afterwards"
    );
    expect(preview.fields.some((field) => field.field === "quantity")).toBe(false);
    expect(preview.frequencyLabel).toBe("Weekly summary");
  });

  it("honours safety control expiry", () => {
    const control: SafetyControl = {
      id: "control-1",
      userId: "owner-1",
      kind: "mute",
      targetUserId: "partner-1",
      circleId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-03-01T00:00:00.000Z",
    };
    expect(isSafetyControlActive(control, now)).toBe(false);
    expect(isSafetyControlActive({ ...control, expiresAt: null }, now)).toBe(true);
  });
});

describe("partner invites", () => {
  const invite: PartnerInvite = {
    id: "invite-1",
    inviterId: "owner-1",
    inviterName: "Owner",
    inviteeEmail: "Partner@Example.com",
    inviteeId: null,
    token: "secret-token",
    status: "pending",
    expiresAt: "2026-04-01T00:00:00.000Z",
    acceptedAt: null,
    createdAt: "2026-03-01T00:00:00.000Z",
  };

  it("accepts only the invited email while the invite is pending", () => {
    expect(
      canAcceptPartnerInvite(invite, { id: "viewer-1", email: "partner@example.com" }, now)
    ).toBe(true);
    expect(
      canAcceptPartnerInvite(invite, { id: "viewer-1", email: "someone@example.com" }, now)
    ).toBe(false);
    expect(
      canAcceptPartnerInvite({ ...invite, status: "declined" }, { id: "viewer-1", email: "partner@example.com" }, now)
    ).toBe(false);
  });

  it("refuses expired invites and invites bound to another account", () => {
    expect(
      canAcceptPartnerInvite(
        { ...invite, expiresAt: "2026-03-01T00:00:00.000Z" },
        { id: "viewer-1", email: "partner@example.com" },
        now
      )
    ).toBe(false);
    expect(
      canAcceptPartnerInvite(
        { ...invite, inviteeId: "other-account" },
        { id: "viewer-1", email: "partner@example.com" },
        now
      )
    ).toBe(false);
  });
});
