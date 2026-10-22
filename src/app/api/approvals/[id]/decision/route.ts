import { z } from "zod";
import { requireRequestContext, authorizationFailure } from "@/server/auth/request-context";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { throwPersistenceError, workflowFailure } from "@/server/reporting/persistence-errors";
import { kickWorker } from "@/server/orchestration/kick";
const schema = z.object({ decision: z.enum(["approve", "reject"]), action_payload_hash: z.string().min(1), plan_version: z.number().int().positive(), reason: z.string().trim().max(1000).optional() }).refine(v => v.decision !== "reject" || (v.reason?.length ?? 0) >= 3);
export const maxDuration = 300;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ["principal", "admin", "hod"]);
    const target = z.string().uuid().safeParse((await params).id);
    if (!target.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid task or action identifier" }, requestId: context.requestId }, { status: 422 });
    const id = target.data;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" }, requestId: context.requestId }, { status: 422 });
    const { data, error } = await createSupabaseAdmin().rpc('orion_decide_approval', { target_id: id, actor_id: context.membershipId, tenant_id: context.institutionId, expected_plan: parsed.data.plan_version, expected_hash: parsed.data.action_payload_hash, requested_decision: parsed.data.decision, reason: parsed.data.reason });
    if (error) throwPersistenceError(error);
    kickWorker("workflow-update");
    return Response.json({ data, requestId: context.requestId });
  } catch (error) {
    const failure = authorizationFailure(error) ?? workflowFailure(error);
    if (failure) return failure;
    console.error("[workflow]", error);
    return Response.json({ error: { code: "WORKFLOW_UNAVAILABLE", message: "The operation could not be confirmed. Refresh before retrying." } }, { status: 503 });
  }
}
