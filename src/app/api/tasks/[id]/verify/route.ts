import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/contracts/http";
import { activeMembership } from "@/server/auth/active-membership";
import { createClient, createServiceClient } from "@/server/db/client";

const VerifyRequestSchema = z.object({
  evidence_version: z.number().int().positive(),
  human_result: z.enum(["confirmed", "rejected"]),
  rejection_reason: z.string().trim().max(1000).default(""),
  trigger: z.literal("human"),
}).refine((input) => input.human_result !== "rejected" || input.rejection_reason.length >= 3);

// Agent review and deadline escalation are durable worker jobs, not browser actions.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  try {
    const session = await createClient();
    const { data: { user }, error } = await session.auth.getUser();
    if (error || !user) return fail("UNAUTHENTICATED", "Login required", requestId, 401);
    const { data: membership, error: membershipError } = await activeMembership(session, user.id);
    if (membershipError) return fail("AUTHORIZATION_UNAVAILABLE", "Authorization service is temporarily unavailable", requestId, 503);
    if (!membership) return fail("FORBIDDEN", "No active membership", requestId, 403);
    const parsed = VerifyRequestSchema.safeParse(await request.json().catch(() => null));
    const taskId = z.string().uuid().safeParse((await params).id);
    if (!parsed.success || !taskId.success) return fail("VALIDATION_ERROR", "A current evidence version and human decision are required", requestId, 422);
    const db = await createServiceClient();
    const result = await db.rpc("orion_verify_task", {
      target_id: taskId.data, actor_id: membership.id, tenant_id: membership.institution_id,
      expected_evidence_version: parsed.data.evidence_version,
      decision: parsed.data.human_result === "confirmed" ? "accepted" : "rejected",
      reason: parsed.data.rejection_reason,
    });
    if (result.error) {
      if (result.error.code === "42501") return fail("FORBIDDEN", "Only the designated verifier may review this task", requestId, 403);
      if (result.error.code === "P0001" || result.error.code === "23505") return fail("VERIFICATION_CONFLICT", "Task changed, evidence is incomplete, or review is pending. Refresh before retrying.", requestId, 409);
      throw result.error;
    }
    return ok(result.data, requestId);
  } catch (error) {
    console.error("[tasks.verify]", { requestId, error });
    return fail("VERIFICATION_UNAVAILABLE", "Verification is temporarily unavailable", requestId, 503);
  }
}
