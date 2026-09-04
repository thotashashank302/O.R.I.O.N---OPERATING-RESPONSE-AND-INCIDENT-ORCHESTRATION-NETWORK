import { describe, expect, it } from "vitest";
import { decryptActionToken, encryptActionToken, hashNonce, issueEmailAction, verifyEmailAction } from "@/server/email/action-token";
import { assertRecipientAllowed, parseRecipientAllowlist } from "@/server/email/outbox";
import { reduceEmailStatus, statusForEmailEvent } from "@/server/email/status";

const secret = "a".repeat(32);
const assignment = "00000000-0000-4000-8000-000000000001";
const membership = "00000000-0000-4000-8000-000000000002";

describe("email action links", () => {
  it("round trips signed scoped claims while storing only a nonce hash", () => {
    const issued = issueEmailAction({ assignmentId: assignment, assignmentVersion: 3, membershipId: membership }, secret, new Date("2026-09-04T10:00:00Z"));
    expect(verifyEmailAction(issued.token, secret, new Date("2026-09-04T10:10:00Z"))).toMatchObject({ assignmentId: assignment, assignmentVersion: 3, membershipId: membership });
    expect(issued.nonceHash).toBe(hashNonce(issued.claims.nonce));
    expect(issued.nonceHash).not.toContain(issued.claims.nonce);
  });

  it("rejects tampering and expiry", () => {
    const issued = issueEmailAction({ assignmentId: assignment, assignmentVersion: 1, membershipId: membership }, secret, new Date("2026-09-04T10:00:00Z"), 1);
    expect(() => verifyEmailAction(`${issued.token}x`, secret, new Date("2026-09-04T10:00:10Z"))).toThrow("Invalid");
    expect(() => verifyEmailAction(issued.token, secret, new Date("2026-09-04T10:02:00Z"))).toThrow("expired");
  });

  it("encrypts a stable retry token at rest and detects tampering", () => {
    const issued = issueEmailAction({ assignmentId: assignment, assignmentVersion: 1, membershipId: membership }, secret);
    const encrypted = encryptActionToken(issued.token, secret);
    expect(decryptActionToken(encrypted, secret)).toBe(issued.token);
    expect(() => decryptActionToken(`${encrypted}x`, secret)).toThrow("Invalid encrypted");
  });
});

describe("email delivery policy", () => {
  it("enforces the demo recipient allowlist", () => {
    const allowlist = parseRecipientAllowlist("allowed@example.com, SECOND@example.com");
    expect(() => assertRecipientAllowed("second@example.com", { demoMode: true, recipientAllowlist: allowlist })).not.toThrow();
    expect(() => assertRecipientAllowed("outside@example.com", { demoMode: true, recipientAllowlist: allowlist })).toThrow("not allowlisted");
    expect(() => assertRecipientAllowed("outside@example.com", { demoMode: false, recipientAllowlist: allowlist })).not.toThrow();
  });

  it("does not downgrade delivery on late progress events", () => {
    expect(statusForEmailEvent("email.delivered")).toBe("delivered");
    expect(reduceEmailStatus("delivered", "sent")).toBe("delivered");
    expect(reduceEmailStatus("sent", "delivered")).toBe("delivered");
    expect(statusForEmailEvent("unknown.event")).toBeNull();
  });
});
