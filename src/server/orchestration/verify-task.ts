import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { runVerificationAgent } from "@/server/agents/verification";
import type { JobRecord } from "./jobs";
import type { ResolutionEvidence } from "@/contracts/operations";
import type { Json } from "@/contracts/database";

export async function verifySubmittedTask(job: JobRecord) {
  if (!job.incidentId) throw new Error("Verification job requires an incident");
  const db = createSupabaseAdmin();
  const taskId = String(job.payload.taskId);
  const { data: task, error } = await db.from("incident_tasks").select("*")
    .eq("id", taskId).eq("institution_id", job.institutionId).single();
  if (error) throw error;
  if (task.state !== "submitted" || task.evidence_version !== job.payload.evidenceVersion) return;
  const { data: incident, error: incidentError } = await db.from("incidents").select("category,version").eq("id", job.incidentId!).single();
  if (incidentError) throw incidentError;
  const { data: rows, error: evidenceError } = await db.from("resolution_evidence").select("*")
    .eq("task_id", taskId).eq("evidence_version", task.evidence_version).order("created_at");
  if (evidenceError) throw evidenceError;
  const evidence: ResolutionEvidence[] = (rows ?? []).map(row => ({
    id: row.id, task_id: row.task_id, uploader_membership_id: row.uploader_membership_id,
    kind: row.kind as ResolutionEvidence["kind"], evidence_version: row.evidence_version,
    content: row.kind === "photo" ? "Private photograph: requires human inspection" : (row.structured_result as {content?:string})?.content ?? "",
    created_at: row.created_at,
  }));
  const started = Date.now();
  const decision = await runVerificationAgent({
    task_id: taskId, task_logical_key: task.logical_task_key, specialist_profile: task.specialist_profile,
    checklist: task.checklist as string[], evidence_requirements: task.evidence_requirements as string[],
    submitted_evidence: evidence, incident_category: incident!.category, requires_human_physical_check: true,
  });
  const failedProvider = decision.reasons.some(reason => /provider|unavailable|failed after|not configured/i.test(reason));
  const { error: persistenceError } = await db.rpc("orion_record_agent_verification", {
    target_id: taskId, tenant_id: job.institutionId, expected_evidence_version: task.evidence_version,
    decision: decision as unknown as Json,
    agent_payload: {
      id: crypto.randomUUID(), provider: "featherless", model: process.env.FEATHERLESS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct",
      prompt_version: "verification-v2", latency_ms: Date.now() - started,
      status: failedProvider ? "failed" : "succeeded",
    },
  });
  if (persistenceError) throw persistenceError;
}
