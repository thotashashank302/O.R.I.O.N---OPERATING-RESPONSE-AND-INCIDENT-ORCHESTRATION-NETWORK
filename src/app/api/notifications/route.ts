import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/contracts/http";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { requireRequestContext } from "@/server/auth/request-context";
import { notificationSchema } from "@/features/notifications/contracts";

const updateSchema = z.object({ notificationId: z.string().uuid(), expectedVersion: z.number().int().positive() }).strict();

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const context = await requireRequestContext(request);
    const { data, error } = await createSupabaseAdmin().from("notifications")
      .select("id,safe_text,link,read_at,created_at,version")
      .eq("institution_id", context.institutionId)
      .eq("recipient_membership_id", context.membershipId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const notifications = z.array(notificationSchema).parse((data ?? []).map((item) => ({ id: item.id, safeText: item.safe_text, link: item.link, readAt: item.read_at, createdAt: item.created_at, version: item.version })));
    return ok(notifications, requestId);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return fail(unauthenticated ? "UNAUTHENTICATED" : "FORBIDDEN", unauthenticated ? "Authentication required" : "Selected membership is unavailable", requestId, unauthenticated ? 401 : 403);
  }
}

export async function PATCH(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const context = await requireRequestContext(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("INVALID_INPUT", "notificationId and expectedVersion are required", requestId, 422);
    const { data, error } = await createSupabaseAdmin().from("notifications")
      .update({ read_at: new Date().toISOString(), version: parsed.data.expectedVersion + 1 })
      .eq("id", parsed.data.notificationId)
      .eq("institution_id", context.institutionId)
      .eq("recipient_membership_id", context.membershipId)
      .eq("version", parsed.data.expectedVersion)
      .select("id,read_at,version").maybeSingle();
    if (error) throw error;
    if (!data) return fail("STALE_CONTEXT", "Notification changed or is unavailable", requestId, 409);
    return ok({ id: data.id, readAt: data.read_at, version: data.version }, requestId);
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return fail(unauthenticated ? "UNAUTHENTICATED" : "FORBIDDEN", unauthenticated ? "Authentication required" : "Selected membership is unavailable", requestId, unauthenticated ? 401 : 403);
  }
}
