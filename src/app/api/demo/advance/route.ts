import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fail, ok } from "@/contracts/http";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { getServerEnv } from "@/server/env";

const inputSchema = z.object({ jobId: z.string().uuid() }).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const env = getServerEnv();
  if (env.DEMO_MODE !== "true") return fail("NOT_FOUND", "Route is unavailable", requestId, 404);

  const bearer = request.headers.get("authorization");
  if (!bearer?.match(/^Bearer\s+\S+$/i)) return fail("UNAUTHENTICATED", "Authentication required", requestId, 401);
  const token = bearer.replace(/^Bearer\s+/i, "");
  const authClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user?.email) return fail("UNAUTHENTICATED", "Authentication required", requestId, 401);

  const allowlist = new Set((process.env.DEMO_ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!allowlist.has(authData.user.email.toLowerCase())) return fail("FORBIDDEN", "Demo administrator is not allowlisted", requestId, 403);

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_INPUT", "A valid jobId is required", requestId, 422);

  const admin = createSupabaseAdmin();
  const { data: job } = await admin.from("jobs").select("id,institution_id,incident_id,status").eq("id", parsed.data.jobId).single();
  if (!job || !["queued", "retry_wait"].includes(job.status)) return fail("JOB_UNAVAILABLE", "Job cannot be advanced", requestId, 409);
  const { data: institution } = await admin.from("institutions").select("is_demo").eq("id", job.institution_id).single();
  const { data: membership } = await admin.from("institution_memberships").select("id,status").eq("institution_id", job.institution_id).eq("user_id", authData.user.id).single();
  if (!institution?.is_demo || membership?.status !== "active") return fail("FORBIDDEN", "Active demo-college membership required", requestId, 403);
  const { data: grants } = await admin.from("role_grants").select("role,starts_at,ends_at,revoked_at").eq("membership_id", membership.id);
  const now = new Date();
  const authorized = grants?.some((grant) =>
    ["principal", "admin"].includes(grant.role)
    && !grant.revoked_at
    && new Date(grant.starts_at) <= now
    && (!grant.ends_at || new Date(grant.ends_at) > now),
  );
  if (!authorized) return fail("FORBIDDEN", "Current principal or admin grant required", requestId, 403);

  const { error } = await admin.from("jobs").update({ due_at: now.toISOString(), status: "queued" }).eq("id", job.id).in("status", ["queued", "retry_wait"]);
  if (error) return fail("ADVANCE_FAILED", "The job could not be advanced", requestId, 500);
  if (job.incident_id) {
    await admin.from("incident_events").insert({
      institution_id: job.institution_id,
      incident_id: job.incident_id,
      actor_membership_id: membership.id,
      actor_type: "human",
      action: "simulated_deadline_advanced",
      safe_payload: { jobId: job.id },
    });
  }
  return ok({ jobId: job.id, label: "Simulated deadline" }, requestId);
}
