import { z } from "zod";
import { requireRequestContext, authorizationFailure } from "@/server/auth/request-context";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { throwPersistenceError, workflowFailure } from "@/server/reporting/persistence-errors";
import { kickWorker } from "@/server/orchestration/kick";
const schema = z.object({ kind: z.enum(["note", "test_result", "photo"]), content: z.string().trim().min(10).max(2000), storage_key: z.string().min(5).optional(), expected_assignment_version: z.number().int().positive() }).refine(v => v.kind !== "photo" || !!v.storage_key);
export const maxDuration = 300;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, []);
    const target = z.string().uuid().safeParse((await params).id);
    if (!target.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid task or action identifier" }, requestId: context.requestId }, { status: 422 });
    const id = target.data;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request" }, requestId: context.requestId }, { status: 422 });
    const { data, error } = await createSupabaseAdmin().rpc('orion_append_evidence', { target_id: id, actor_id: context.membershipId, tenant_id: context.institutionId, expected_version: parsed.data.expected_assignment_version, evidence_kind: parsed.data.kind, content: parsed.data.content, object_key: parsed.data.storage_key });
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request);
    const target = z.string().uuid().safeParse((await params).id);
    if (!target.success) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Invalid task or action identifier" }, requestId: context.requestId }, { status: 422 });
    const id = target.data;
    const db = createSupabaseAdmin();
    const { data: task, error } = await db.from("incident_tasks").select("id,evidence_version,incident_plans!inner(incident_id)")
      .eq("id", id).eq("institution_id", context.institutionId).maybeSingle();
    if (error) throw error;
    if (!task) return Response.json({ error: { message: "Task unavailable" } }, { status: 404 });
    const allowed = await db.rpc("orion_can_read_incident", { actor_id: context.membershipId, tenant_id: context.institutionId, target_id: task.incident_plans.incident_id });
    if (allowed.error) throw allowed.error;
    if (!allowed.data) return Response.json({ error: { message: "Task unavailable" } }, { status: 404 });
    const evidence = await db.from("resolution_evidence").select("id,kind,structured_result,storage_key,evidence_version,created_at")
      .eq("task_id", id).eq("evidence_version", task.evidence_version).order("created_at");
    if (evidence.error) throw evidence.error;
    const rows = await Promise.all((evidence.data ?? []).map(async row => {
      let imageUrl: string | null = null;
      if (row.kind === "photo" && row.storage_key) {
        const previewable = await db.rpc("orion_can_preview_evidence", { actor_id: context.membershipId, tenant_id: context.institutionId, evidence_id: row.id });
        if (previewable.error) throw previewable.error;
        if (!previewable.data) return { id: row.id, kind: row.kind, result: row.structured_result, evidenceVersion: row.evidence_version, imageUrl: null };
        const signed = await db.storage.from("evidence-vault").createSignedUrl(row.storage_key, 60);
        if (signed.error) throw signed.error;
        imageUrl = signed.data.signedUrl;
      }
      return { id: row.id, kind: row.kind, result: row.structured_result, evidenceVersion: row.evidence_version, imageUrl };
    }));
    return Response.json({ data: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authorizationFailure(error) ?? Response.json({ error: { message: "Evidence is temporarily unavailable" } }, { status: 503 });
  }
}
