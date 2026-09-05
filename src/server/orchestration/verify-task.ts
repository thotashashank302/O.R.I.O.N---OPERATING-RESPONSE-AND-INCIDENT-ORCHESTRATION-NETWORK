import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { runVerificationAgent } from "@/server/agents/verification";
import { enqueueCommanderJob } from "./commander-enqueue";
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
  const { data: incident } = await db.from("incidents").select("category,version").eq("id", job.incidentId!).single();
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
  const { error: runError } = await db.from("agent_runs").insert({
    id: crypto.randomUUID(),
    institution_id: job.institutionId, incident_id: job.incidentId, agent_name: "verification",
    provider: "featherless", model: process.env.FEATHERLESS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct",
    prompt_version: "verification-v2", latency_ms: Date.now()-started,
    status: failedProvider ? "failed" : "succeeded", validated_outcome: decision as unknown as Json,
  });
  if (runError) throw runError;
  // If provider failed or timed out, fail-safe allows human review to proceed cleanly
  const { error: recordError } = await db.from("verification_records").insert({
    institution_id: job.institutionId, task_id: taskId, evidence_version: task.evidence_version,
    human_result: "pending", agent_verdict: decision.verdict === "failed" ? "fail" : "needs_human_review",
    reasons: decision as unknown as Json,
  });
  if (recordError) throw recordError;
  const { error: eventError } = await db.from("incident_events").insert({
    institution_id: job.institutionId, incident_id: job.incidentId!, actor_type: "agent",
    action: "verification_reviewed", safe_payload: {taskId, verdict: decision.verdict},
  });
  if (eventError) throw eventError;
  if (decision.verdict === "failed") {
    const { error: taskError } = await db.from("incident_tasks").update({state:"failed"}).eq("id",taskId).eq("state","submitted");
    if (taskError) throw taskError;
    await db.from("assignments").update({active_version:false}).eq("task_id",taskId).eq("state","completed");
    await db.from("incidents").update({state:"reopened",version:incident!.version+1}).eq("id",job.incidentId!).eq("version",incident!.version);
    await enqueueCommanderJob(job.incidentId!, decision.suggested_replan_reason ?? "Evidence review failed", "verification-"+taskId);
  }
}
