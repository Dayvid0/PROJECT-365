import type { CircleInvite, CircleRole } from "./types";

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
