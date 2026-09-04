import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/contracts/http";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";
import { requireRequestContext } from "@/server/auth/request-context";

const idSchema = z.string().uuid();

export async function GET(request: Request, context: { params: Promise<{ incidentId: string }> }) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const auth = await requireRequestContext(request);
    const incidentId = idSchema.parse((await context.params).incidentId);
    const session = await createSupabaseSessionClient();
    const readable = await session.from("incidents").select("id").eq("id", incidentId).eq("institution_id", auth.institutionId).maybeSingle();
    if (!readable.data) return fail("NOT_FOUND", "Incident is unavailable", requestId, 404);
    const { data, error } = await createSupabaseAdmin().from("incident_events")
      .select("id,actor_type,action,safe_payload,created_at")
      .eq("institution_id", auth.institutionId).eq("incident_id", incidentId)
      .order("created_at", { ascending: true }).limit(200);
    if (error) throw error;
    return ok((data ?? []).map((event) => ({ id: event.id, actorType: event.actor_type, action: event.action, safePayload: event.safe_payload, createdAt: event.created_at })), requestId);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return fail(unauthenticated ? "UNAUTHENTICATED" : "FORBIDDEN", unauthenticated ? "Authentication required" : "Selected membership is unavailable", requestId, unauthenticated ? 401 : 403);
  }
}
