import { describe, expect, it } from "vitest";
import {
  canAcceptCircleInvite,
  canDeleteCircle,
  canDeleteCircleContent,
  canJoinCircleChallenge,
  canManageCircle,
  canRemoveCircleMember,
  canSetCircleMemberRole,
  hasActiveSafetyBoundary,
} from "../circles";
import type { CircleInvite } from "../types";

const now = new Date("2026-03-03T12:00:00.000Z");

const invite: CircleInvite = {
  id: "invite-1",
  circleId: "circle-1",
  circleName: "Walk crew",
  inviterId: "owner-1",
  inviterName: "Owner",
  inviteeEmail: "Member@Example.com",
  inviteeId: null,
  token: "secret-token",
  status: "pending",
  expiresAt: "2026-04-01T00:00:00.000Z",
  acceptedAt: null,
  createdAt: "2026-03-01T00:00:00.000Z",
};

describe("circle permissions", () => {
  it("keeps invitation and member management with owners and admins", () => {
    expect(canManageCircle("owner")).toBe(true);
    expect(canManageCircle("admin")).toBe(true);
    expect(canManageCircle("member")).toBe(false);
    expect(canDeleteCircle("admin")).toBe(false);
    expect(canDeleteCircle("owner")).toBe(true);
  });

  it("lets only the owner change roles and never promotes to owner or self", () => {
    expect(canSetCircleMemberRole("owner", "member", false)).toBe(true);
    expect(canSetCircleMemberRole("admin", "member", false)).toBe(false);
    expect(canSetCircleMemberRole("owner", "owner", false)).toBe(false);
    expect(canSetCircleMemberRole("owner", "admin", true)).toBe(false);
  });

  it("stops admins removing other admins and nobody removing the owner or themselves", () => {
    expect(canRemoveCircleMember("owner", "admin", false)).toBe(true);
    expect(canRemoveCircleMember("admin", "member", false)).toBe(true);
    expect(canRemoveCircleMember("admin", "admin", false)).toBe(false);
    expect(canRemoveCircleMember("owner", "owner", false)).toBe(false);
    expect(canRemoveCircleMember("owner", "member", true)).toBe(false);
  });
});

describe("circle invites", () => {
  it("requires the exact invited email while the invite is pending", () => {
    expect(
      canAcceptCircleInvite(invite, { id: "viewer-1", email: "member@example.com" }, now)
    ).toBe(true);
    expect(
      canAcceptCircleInvite(invite, { id: "viewer-1", email: "other@example.com" }, now)
    ).toBe(false);
    expect(
      canAcceptCircleInvite(
        { ...invite, status: "declined" },
        { id: "viewer-1", email: "member@example.com" },
        now
      )
    ).toBe(false);
  });

  it("rejects expired invites and other bound accounts", () => {
    expect(
      canAcceptCircleInvite(
        { ...invite, expiresAt: "2026-03-01T00:00:00.000Z" },
        { id: "viewer-1", email: "member@example.com" },
        now
      )
    ).toBe(false);
    expect(
      canAcceptCircleInvite(
        { ...invite, inviteeId: "someone-else" },
        { id: "viewer-1", email: "member@example.com" },
        now
      )
    ).toBe(false);
  });
});

describe("circle support permissions", () => {
  it("lets authors and managers delete content but never other members", () => {
    expect(canDeleteCircleContent("member", true)).toBe(true);
    expect(canDeleteCircleContent("admin", false)).toBe(true);
    expect(canDeleteCircleContent("owner", false)).toBe(true);
    expect(canDeleteCircleContent("member", false)).toBe(false);
    expect(canDeleteCircleContent(null, false)).toBe(false);
  });

  it("closes challenge joining when the window ends", () => {
    expect(canJoinCircleChallenge({ endsAt: "2026-03-04T00:00:00.000Z" }, now)).toBe(true);
    expect(canJoinCircleChallenge({ endsAt: "2026-03-03T00:00:00.000Z" }, now)).toBe(false);
  });

  it("honours live block and mute boundaries in either direction", () => {
    const controls = [
      {
        userId: "viewer-1",
        targetUserId: "member-1",
        kind: "mute" as const,
        expiresAt: null,
      },
    ];
    expect(hasActiveSafetyBoundary("viewer-1", "member-1", controls, now)).toBe(true);
    expect(hasActiveSafetyBoundary("viewer-1", "member-2", controls, now)).toBe(false);
    expect(
      hasActiveSafetyBoundary(
        "viewer-1",
        "member-1",
        [{ ...controls[0]!, expiresAt: "2026-03-02T00:00:00.000Z" }],
        now
      )
    ).toBe(false);
    expect(
      hasActiveSafetyBoundary(
        "viewer-1",
        "member-1",
        [{ ...controls[0]!, userId: "member-1", targetUserId: "viewer-1" }],
        now
      )
    ).toBe(true);
  });
});
