import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { ulid } from "ulidx";
import { canAcceptPartnerInvite } from "@/domain/sharing";
import type { PartnerInvite, PartnerSummary } from "@/domain/types";
import type { PartnerInviteInput } from "@/domain/validation";
import { db } from "@/server/db";
import { partnerInvites, users } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

type InviteRow = typeof partnerInvites.$inferSelect;

const INVITE_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toInvite(row: InviteRow, inviterName: string): PartnerInvite {
  return {
    id: row.id,
    inviterId: row.inviterUserId,
    inviterName,
    inviteeEmail: row.inviteeEmail,
    inviteeId: row.inviteeUserId,
    token: row.token,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function listWithInviters(
  where: ReturnType<typeof and>
): Promise<PartnerInvite[]> {
  const rows = await db
    .select({ invite: partnerInvites, inviterName: users.name })
    .from(partnerInvites)
    .innerJoin(users, eq(partnerInvites.inviterUserId, users.id))
    .where(where)
    .orderBy(desc(partnerInvites.createdAt));
  return rows.map((row) => toInvite(row.invite, row.inviterName));
}

async function findByToken(token: string): Promise<PartnerInvite> {
  const [row] = await db
    .select({ invite: partnerInvites, inviterName: users.name })
    .from(partnerInvites)
    .innerJoin(users, eq(partnerInvites.inviterUserId, users.id))
    .where(eq(partnerInvites.token, token))
    .limit(1);
  if (!row) throw new NotFoundError("Invite not found.");
  return toInvite(row.invite, row.inviterName);
}

export const partnerInviteRepository = {
  async listInvites(userId: string, email: string) {
    const [sent, received] = await Promise.all([
      listWithInviters(eq(partnerInvites.inviterUserId, userId)),
      listWithInviters(
        and(
          eq(partnerInvites.inviteeEmail, normalizeEmail(email)),
          eq(partnerInvites.status, "pending")
        )
      ),
    ]);
    return { sent, received };
  },

  async createInvite(userId: string, input: PartnerInviteInput): Promise<PartnerInvite> {
    const inviteeEmail = normalizeEmail(input.email);
    const [owner] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!owner) throw new NotFoundError("Account not found.");
    if (normalizeEmail(owner.email) === inviteeEmail) {
      throw new ValidationError("You cannot invite yourself.");
    }

    const [existing] = await db
      .select({ id: partnerInvites.id, status: partnerInvites.status })
      .from(partnerInvites)
      .where(
        and(
          eq(partnerInvites.inviterUserId, userId),
          eq(partnerInvites.inviteeEmail, inviteeEmail)
        )
      )
      .limit(1);
    if (existing?.status === "pending") {
      throw new ValidationError("A pending invite to this email already exists.");
    }
    if (existing?.status === "accepted") {
      throw new ValidationError("You are already connected with this partner.");
    }

    const now = new Date();
    const token = randomBytes(24).toString("base64url");
    const [row] = await db
      .insert(partnerInvites)
      .values({
        id: ulid(),
        inviterUserId: userId,
        inviteeEmail,
        inviteeUserId: null,
        token,
        status: "pending",
        expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toInvite(row!, owner.name);
  },

  async getInviteForViewer(token: string, userId: string, email: string) {
    const invite = await findByToken(token);
    return {
      invite,
      canAccept: canAcceptPartnerInvite(invite, { id: userId, email }),
    };
  },

  async respondToInvite(
    token: string,
    userId: string,
    email: string,
    accept: boolean
  ): Promise<PartnerInvite> {
    const invite = await findByToken(token);
    if (!accept) {
      if (invite.status !== "pending") {
        throw new ValidationError("This invite is no longer pending.");
      }
      if (normalizeEmail(invite.inviteeEmail) !== normalizeEmail(email)) {
        throw new ValidationError("This invite was sent to a different email address.");
      }
    } else if (!canAcceptPartnerInvite(invite, { id: userId, email })) {
      throw new ValidationError("This invite cannot be accepted by this account.");
    }

    const now = new Date();
    const [updated] = await db
      .update(partnerInvites)
      .set({
        status: accept ? "accepted" : "declined",
        inviteeUserId: userId,
        acceptedAt: accept ? now : null,
        updatedAt: now,
      })
      .where(eq(partnerInvites.id, invite.id))
      .returning();
    const [viewer] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return toInvite(updated!, viewer?.name ?? "");
  },

  async cancelInvite(userId: string, inviteId: string): Promise<void> {
    const now = new Date();
    const updated = await db
      .update(partnerInvites)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(partnerInvites.id, inviteId),
          eq(partnerInvites.inviterUserId, userId),
          eq(partnerInvites.status, "pending")
        )
      )
      .returning({ id: partnerInvites.id });
    if (!updated.length) throw new NotFoundError("Pending invite not found.");
  },

  async listPartners(userId: string): Promise<PartnerSummary[]> {
    const rows = await db
      .select()
      .from(partnerInvites)
      .where(
        and(
          eq(partnerInvites.status, "accepted"),
          or(
            eq(partnerInvites.inviterUserId, userId),
            eq(partnerInvites.inviteeUserId, userId)
          )
        )
      )
      .orderBy(desc(partnerInvites.acceptedAt));

    const otherIds = rows
      .map((row) => (row.inviterUserId === userId ? row.inviteeUserId : row.inviterUserId))
      .filter((id): id is string => Boolean(id));
    if (!otherIds.length) return [];

    const partners = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, [...new Set(otherIds)]));
    const byId = new Map(partners.map((partner) => [partner.id, partner]));

    return rows.flatMap((row) => {
      const otherId = row.inviterUserId === userId ? row.inviteeUserId : row.inviterUserId;
      if (!otherId) return [];
      const partner = byId.get(otherId);
      if (!partner) return [];
      return [{
        userId: partner.id,
        name: partner.name,
        email: partner.email,
        direction: row.inviterUserId === userId ? ("invited" as const) : ("invited_by" as const),
        connectedAt: (row.acceptedAt ?? row.createdAt).toISOString(),
      }];
    });
  },

  async hasAcceptedLink(ownerId: string, recipientId: string): Promise<boolean> {
    const rows = await db
      .select({ id: partnerInvites.id })
      .from(partnerInvites)
      .where(
        and(
          eq(partnerInvites.status, "accepted"),
          or(
            and(
              eq(partnerInvites.inviterUserId, ownerId),
              eq(partnerInvites.inviteeUserId, recipientId)
            ),
            and(
              eq(partnerInvites.inviterUserId, recipientId),
              eq(partnerInvites.inviteeUserId, ownerId)
            )
          )
        )
      )
      .limit(1);
    return rows.length > 0;
  },
};
