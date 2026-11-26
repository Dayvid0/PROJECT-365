import { isSafetyControlActive } from "./sharing";
import type { CircleInvite, CircleRole, SafetyControl } from "./types";

/**
 * Circle permissions are deliberately small. Invitation and member management
 * stay with owner/admin; ordinary members can only choose what they share and
 * exercise their own safety controls.
 */
export function canManageCircle(role: CircleRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteCircle(role: CircleRole | null): boolean {
  return role === "owner";
}

export function canSetCircleMemberRole(
  actorRole: CircleRole | null,
  targetRole: CircleRole,
  isSelf: boolean
): boolean {
  if (actorRole !== "owner") return false;
  if (isSelf || targetRole === "owner") return false;
  return true;
}

export function canRemoveCircleMember(
  actorRole: CircleRole | null,
  targetRole: CircleRole,
  isSelf: boolean
): boolean {
  if (!canManageCircle(actorRole)) return false;
  if (isSelf || targetRole === "owner") return false;
  if (actorRole === "admin" && targetRole === "admin") return false;
  return true;
}

/**
 * Supportive content stays editable only by its author or a circle manager.
 * Ordinary members can always react, comment, and join a challenge.
 */
export function canDeleteCircleContent(role: CircleRole | null, isAuthor: boolean): boolean {
  return isAuthor || canManageCircle(role);
}

/** A challenge is opt-in until its window closes; it never exposes progress or ranking. */
export function canJoinCircleChallenge(
  challenge: { endsAt: string | Date },
  now: Date = new Date()
): boolean {
  return new Date(challenge.endsAt) > now;
}

/**
 * Block and mute are honoured in both directions. If either person set a live
 * boundary, neither their shared update nor their support content is shown.
 */
export function hasActiveSafetyBoundary(
  viewerId: string,
  otherUserId: string,
  controls: Array<
    Pick<SafetyControl, "userId" | "targetUserId" | "kind" | "expiresAt">
  >,
  now: Date = new Date()
): boolean {
  return controls.some((control) => {
    if (control.kind === "leave" || !control.targetUserId) return false;
    const involvesPair =
      (control.userId === viewerId && control.targetUserId === otherUserId) ||
      (control.userId === otherUserId && control.targetUserId === viewerId);
    return involvesPair && isSafetyControlActive(control, now);
  });
}

/** Same exact-email rule as partner invites; a forwarded link cannot join the wrong account. */
export function canAcceptCircleInvite(
  invite: {
    status: CircleInvite["status"];
    inviteeEmail: string;
    inviteeId?: string | null;
    inviteeUserId?: string | null;
    expiresAt: string | Date;
  },
  viewer: { id: string; email: string },
  now: Date = new Date()
): boolean {
  if (invite.status !== "pending") return false;
  if (invite.inviteeEmail.trim().toLowerCase() !== viewer.email.trim().toLowerCase()) {
    return false;
  }
  const boundId = invite.inviteeId ?? invite.inviteeUserId ?? null;
  if (boundId && boundId !== viewer.id) return false;
  return new Date(invite.expiresAt) > now;
}
