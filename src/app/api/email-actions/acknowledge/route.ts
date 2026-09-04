import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/contracts/http";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { hashNonce, verifyEmailAction } from "@/server/email/action-token";
import { getEmailActionEnv } from "@/server/env";

const inputSchema = z.object({ token: z.string().min(40).max(4096) }).strict();
export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_INPUT", "A valid action token is required", requestId, 422);
  let env: ReturnType<typeof getEmailActionEnv>;
  try {
    env = getEmailActionEnv();
  } catch {
    return fail("ACTION_UNAVAILABLE", "Email actions are not configured", requestId, 503);
  }
  try {
    const claims = verifyEmailAction(parsed.data.token, env.EMAIL_ACTION_SECRET);
    const client = await createSupabaseSessionClient();
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) return fail("UNAUTHENTICATED", "Sign in as the intended staff member", requestId, 401);
    const { data: membership } = await createSupabaseAdmin().from("institution_memberships").select("id,user_id,status").eq("id", claims.membershipId).single();
    if (!membership || membership.user_id !== authData.user.id || membership.status !== "active") {
      return fail("FORBIDDEN", "This link belongs to another or inactive staff member", requestId, 403);
    }
    const { data: assignmentId, error } = await client.rpc("acknowledge_email_assignment", {
      token_id: claims.tokenId,
      token_nonce_hash: hashNonce(claims.nonce),
      expected_assignment_version: claims.assignmentVersion,
    });
    if (error) return fail("ACTION_UNAVAILABLE", "This link is expired, used, or stale", requestId, 409);
    return ok({ assignmentId, state: "acknowledged" }, requestId);
  } catch {
    return fail("ACTION_UNAVAILABLE", "This link is invalid or expired", requestId, 409);
  }
}
