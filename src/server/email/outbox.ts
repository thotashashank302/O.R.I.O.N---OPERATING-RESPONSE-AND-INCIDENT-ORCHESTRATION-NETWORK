import { z } from "zod";
import type { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { decryptActionToken, encryptActionToken, issueEmailAction, verifyEmailAction } from "./action-token";
import type { EmailTransport } from "./resend-transport";

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

const outboxPayloadSchema = z.object({ outboxId: z.string().uuid() }).strict();

export interface OutboxDeliveryConfig {
  appUrl: string;
  actionSecret: string;
  demoMode: boolean;
  recipientAllowlist: ReadonlySet<string>;
}

export function parseRecipientAllowlist(value: string): Set<string> {
  return new Set(value.split(",").map((recipient) => recipient.replace(/["']/g, "").trim().toLowerCase()).filter(Boolean));
}

export function assertRecipientAllowed(recipient: string, config: Pick<OutboxDeliveryConfig, "demoMode" | "recipientAllowlist">): void {
  if (config.demoMode && !recipient.toLowerCase().endsWith("@orion-demo.edu") && !config.recipientAllowlist.has(recipient.toLowerCase())) {
    throw new Error("Demo recipient is not allowlisted");
  }
}

export async function deliverOutbox(
  payload: unknown,
  client: AdminClient,
  transport: EmailTransport,
  config: OutboxDeliveryConfig,
): Promise<{ providerId: string; alreadySent: boolean }> {
  const { outboxId } = outboxPayloadSchema.parse(payload);
  const { data: outbox, error: outboxError } = await client.from("email_outbox")
    .select("id,institution_id,assignment_id,assignment_version,recipient,message_type,idempotency_key,provider_id,transport_state,action_token_ciphertext")
    .eq("id", outboxId).single();
  if (outboxError || !outbox) throw new Error("Email outbox item was not found");
  if (outbox.provider_id && ["sent", "delivered", "bounced", "suppressed"].includes(outbox.transport_state)) {
    return { providerId: outbox.provider_id, alreadySent: true };
  }
  if (!outbox.assignment_id || !outbox.assignment_version) throw new Error("Outbox assignment metadata is incomplete");
  assertRecipientAllowed(outbox.recipient, config);

  const { data: assignment, error: assignmentError } = await client.from("assignments")
    .select("id,institution_id,assignee_membership_id,acknowledgement_deadline,version,active_version,state")
    .eq("id", outbox.assignment_id).single();
  if (assignmentError || !assignment || assignment.institution_id !== outbox.institution_id) throw new Error("Assignment was not found");
  if (!assignment.active_version || assignment.version !== outbox.assignment_version || assignment.state !== "offered") {
    throw new Error("Assignment is stale or no longer awaiting acknowledgement");
  }

  let actionToken: string;
  if (outbox.action_token_ciphertext) {
    actionToken = decryptActionToken(outbox.action_token_ciphertext, config.actionSecret);
    const claims = verifyEmailAction(actionToken, config.actionSecret);
    if (claims.assignmentId !== assignment.id || claims.assignmentVersion !== assignment.version || claims.membershipId !== assignment.assignee_membership_id) {
      throw new Error("Persisted acknowledgement link is stale");
    }
  } else {
    const issued = issueEmailAction({
      assignmentId: assignment.id,
      assignmentVersion: assignment.version,
      membershipId: assignment.assignee_membership_id,
    }, config.actionSecret);
    actionToken = issued.token;
    const { error: tokenError } = await client.from("email_action_tokens").insert({
      id: issued.claims.tokenId,
      institution_id: outbox.institution_id,
      assignment_id: assignment.id,
      assignment_version: assignment.version,
      intended_membership_id: assignment.assignee_membership_id,
      nonce_hash: issued.nonceHash,
      expires_at: issued.expiresAt.toISOString(),
    });
    if (tokenError) throw new Error("Could not issue the acknowledgement link");
    const encrypted = encryptActionToken(actionToken, config.actionSecret);
    const { data: persistedToken, error: tokenPersistError } = await client.from("email_outbox")
      .update({ action_token_ciphertext: encrypted }).eq("id", outbox.id).is("action_token_ciphertext", null)
      .select("action_token_ciphertext").maybeSingle();
    if (tokenPersistError) throw new Error("Could not persist the acknowledgement link");
    if (!persistedToken) {
      const { data: existingToken, error: existingTokenError } = await client.from("email_outbox")
        .select("action_token_ciphertext").eq("id", outbox.id).single();
      if (existingTokenError || !existingToken?.action_token_ciphertext) throw new Error("Could not reload the acknowledgement link");
      actionToken = decryptActionToken(existingToken.action_token_ciphertext, config.actionSecret);
      verifyEmailAction(actionToken, config.actionSecret);
    }
  }
  const { error: sendingError } = await client.from("email_outbox").update({ transport_state: "sending", updated_at: new Date().toISOString() }).eq("id", outbox.id);
  if (sendingError) throw new Error("Could not claim the email outbox item");

  const result = await transport.sendAssignment({
    recipient: outbox.recipient,
    actionUrl: `${config.appUrl.replace(/\/$/, "")}/email-actions/confirm?token=${encodeURIComponent(actionToken)}`,
    acknowledgementDeadline: new Date(assignment.acknowledgement_deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }),
    urgent: outbox.message_type === "urgent_alert",
    idempotencyKey: outbox.idempotency_key,
  });
  const { error: sentError } = await client.from("email_outbox").update({
    provider_id: result.providerId,
    transport_state: "sent",
    updated_at: new Date().toISOString(),
  }).eq("id", outbox.id);
  if (sentError) throw new Error("Email sent but provider status could not be persisted");
  return { providerId: result.providerId, alreadySent: false };
}
