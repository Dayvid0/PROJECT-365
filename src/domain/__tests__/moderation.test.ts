import { describe, expect, it } from "vitest";
import {
  canJoinPublicChallenge,
  canTransitionPublicChallengeStatus,
  canTransitionSafetyReportStatus,
  isModeratorEmail,
  isPublicDiscoveryConfigured,
  parseModeratorEmails,
} from "../moderation";

describe("moderation gates", () => {
  it("parses moderator emails as normalised, unique addresses", () => {
    expect(parseModeratorEmails(" Moderator@Example.com ,moderator@example.com, ,second@example.com ")).toEqual([
      "moderator@example.com",
      "second@example.com",
    ]);
    expect(parseModeratorEmails(undefined)).toEqual([]);
  });

  it("recognises an exact allowlisted email", () => {
    const allowlist = " Moderator@Example.com,second@example.com ";
    expect(isModeratorEmail("moderator@example.com", allowlist)).toBe(true);
    expect(isModeratorEmail("other@example.com", allowlist)).toBe(false);
    expect(isModeratorEmail(null, allowlist)).toBe(false);
  });

  it("requires both reviewers and a contact address before discovery is configured", () => {
    expect(isPublicDiscoveryConfigured({
      moderatorEmails: "moderator@example.com",
      contactEmail: "safety@example.com",
    })).toBe(true);
    expect(isPublicDiscoveryConfigured({
      moderatorEmails: "moderator@example.com",
      contactEmail: "not-an-email",
    })).toBe(false);
    expect(isPublicDiscoveryConfigured({
      moderatorEmails: "",
      contactEmail: "safety@example.com",
    })).toBe(false);
  });

  it("only allows forward safety-report transitions", () => {
    expect(canTransitionSafetyReportStatus("open", "reviewing")).toBe(true);
    expect(canTransitionSafetyReportStatus("open", "resolved")).toBe(true);
    expect(canTransitionSafetyReportStatus("reviewing", "dismissed")).toBe(true);
    expect(canTransitionSafetyReportStatus("resolved", "open")).toBe(false);
    expect(canTransitionSafetyReportStatus("dismissed", "reviewing")).toBe(false);
    expect(canTransitionSafetyReportStatus("reviewing", "reviewing")).toBe(false);
  });

  it("only allows forward public-challenge transitions", () => {
    expect(canTransitionPublicChallengeStatus("proposed", "active")).toBe(true);
    expect(canTransitionPublicChallengeStatus("proposed", "rejected")).toBe(true);
    expect(canTransitionPublicChallengeStatus("active", "retired")).toBe(true);
    expect(canTransitionPublicChallengeStatus("active", "proposed")).toBe(false);
    expect(canTransitionPublicChallengeStatus("rejected", "active")).toBe(false);
    expect(canTransitionPublicChallengeStatus("retired", "active")).toBe(false);
  });

  it("allows joins only for visible, unexpired challenges", () => {
    const now = new Date("2026-11-26T00:00:00.000Z");
    expect(canJoinPublicChallenge({ status: "active", endsAt: "2026-11-27T00:00:00.000Z" }, now)).toBe(true);
    expect(canJoinPublicChallenge({ status: "active", endsAt: "2026-11-25T00:00:00.000Z" }, now)).toBe(false);
    expect(canJoinPublicChallenge({ status: "proposed", endsAt: "2026-11-27T00:00:00.000Z" }, now)).toBe(false);
  });
});
