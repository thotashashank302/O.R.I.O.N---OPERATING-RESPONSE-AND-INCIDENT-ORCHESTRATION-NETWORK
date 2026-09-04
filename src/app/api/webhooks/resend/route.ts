import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { fail, ok } from "@/contracts/http";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { recordVerifiedEmailEvent } from "@/server/email/webhook";
import { getEmailWebhookEnv } from "@/server/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature) return fail("INVALID_SIGNATURE", "Webhook signature headers are required", requestId, 400);
  const payload = await request.text();
  let env: ReturnType<typeof getEmailWebhookEnv>;
  try {
    env = getEmailWebhookEnv();
  } catch {
    return fail("WEBHOOK_UNAVAILABLE", "Email webhook is not configured", requestId, 503);
  }
  let event: unknown;
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    event = resend.webhooks.verify({
      payload,
      headers: { id: eventId, timestamp, signature },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch {
    return fail("INVALID_WEBHOOK", "Webhook signature is invalid", requestId, 400);
  }
  try {
    const result = await recordVerifiedEmailEvent(eventId, event, createSupabaseAdmin());
    return ok(result, requestId);
  } catch {
    return fail("WEBHOOK_UNAVAILABLE", "Verified webhook could not be recorded", requestId, 503);
  }
}
