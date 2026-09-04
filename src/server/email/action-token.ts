import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const claimsSchema = z.object({
  tokenId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  assignmentVersion: z.number().int().positive(),
  membershipId: z.string().uuid(),
  nonce: z.string().min(32),
  exp: z.number().int().positive(),
}).strict();

export type EmailActionClaims = z.infer<typeof claimsSchema>;

export interface IssuedEmailAction {
  token: string;
  claims: EmailActionClaims;
  nonceHash: string;
  expiresAt: Date;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function hashNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function encryptActionToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(`orion-email-token:${secret}`).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptActionToken(value: string, secret: string): string {
  const [ivValue, tagValue, encryptedValue, extra] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue || extra) throw new Error("Invalid encrypted action token");
  try {
    const key = createHash("sha256").update(`orion-email-token:${secret}`).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Invalid encrypted action token");
  }
}

export function issueEmailAction(
  input: { assignmentId: string; assignmentVersion: number; membershipId: string },
  secret: string,
  now = new Date(),
  ttlMinutes = 30,
): IssuedEmailAction {
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const claims = claimsSchema.parse({
    tokenId: randomUUID(),
    assignmentId: input.assignmentId,
    assignmentVersion: input.assignmentVersion,
    membershipId: input.membershipId,
    nonce,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });
  const payload = encode(JSON.stringify(claims));
  return { token: `${payload}.${sign(payload, secret)}`, claims, nonceHash: hashNonce(nonce), expiresAt };
}

export function verifyEmailAction(token: string, secret: string, now = new Date()): EmailActionClaims {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) throw new Error("Invalid action token");
  const expected = sign(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error("Invalid action token");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid action token");
  }
  const claims = claimsSchema.parse(decoded);
  if (claims.exp <= Math.floor(now.getTime() / 1000)) throw new Error("Action token has expired");
  return claims;
}
