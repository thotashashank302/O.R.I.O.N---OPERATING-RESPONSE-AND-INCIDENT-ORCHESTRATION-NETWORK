import { z } from "zod";
import { requireRequestContext, authorizationFailure } from "@/server/auth/request-context";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { throwPersistenceError, workflowFailure } from "@/server/reporting/persistence-errors";
import { kickWorker } from "@/server/orchestration/kick";
const schema = z.object({ reason: z.string().trim().min(10).max(1000), expected_version: z.number().int().positive(), new_priority: z.enum(["critical", "high", "normal", "low"]).optional(), task_id: z.string().uuid().optional(), new_assignee_membership_id: z.string().uuid().optional(), new_verifier_membership_id: z.string().uuid().optional() }).refine(v => !!(v.new_priority || v.task_id && (v.new_assignee_membership_id || v.new_verifier_membership_id)));
export const maxDuration = 300;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ["principal", "admin", "hod"]);
    const target = z.string().uuid().safeParse((await params).id);
    if (!target.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid task or action identifier" }, requestId: context.requestId }, { status: 422 });
    const id = target.data;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" }, requestId: context.requestId }, { status: 422 });
    const { data, error } = await createSupabaseAdmin().rpc('orion_override_incident', { target_id: id, actor_id: context.membershipId, tenant_id: context.institutionId, expected_version: parsed.data.expected_version, reason: parsed.data.reason, new_priority: parsed.data.new_priority, task_id: parsed.data.task_id, new_assignee: parsed.data.new_assignee_membership_id, new_verifier: parsed.data.new_verifier_membership_id });
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
