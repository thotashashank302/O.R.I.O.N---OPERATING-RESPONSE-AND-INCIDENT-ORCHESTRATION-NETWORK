import { z } from "zod";
import type { EmailStatus } from "@/contracts/domain";
import type { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { statusForEmailEvent } from "./status";

type AdminClient = ReturnType<typeof createSupabaseAdmin>;

const webhookEventSchema = z.object({
  type: z.string().min(1),
  created_at: z.string().datetime(),
  data: z.object({ email_id: z.string().min(1) }).passthrough(),
}).passthrough();

export async function recordVerifiedEmailEvent(eventId: string, event: unknown, client: AdminClient): Promise<{ recorded: boolean; ignored: boolean }> {
  const parsed = webhookEventSchema.parse(event);
  const nextState = statusForEmailEvent(parsed.type);
  if (!nextState) return { recorded: false, ignored: true };
  const { data, error } = await client.rpc("record_email_event", {
    provider_event_id: eventId,
    provider_email_id: parsed.data.email_id,
    event_type: parsed.type,
    happened_at: parsed.created_at,
    next_state: nextState as EmailStatus,
  });
  if (error) throw new Error("Email event could not be persisted");
  return { recorded: Boolean(data), ignored: false };
}
