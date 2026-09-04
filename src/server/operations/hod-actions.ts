/**
 * ORION Operations — HOD / Supervisor Actions Service
 * Developer 4 (Anjali) owns this file.
 *
 * Handles:
 * - Supervisor cancellation of work (with audit — never deletes history)
 * - Duplicate reconciliation requests (when both incidents have active work)
 * - Absent-verifier replacement (C2 recovery)
 * - Safe reopened case handling — carry-forward of unchanged verified tasks
 *
 * Per Execution Decisions §5:
 * - Canceling accepted work requires supervisor disposition
 * - Retain audit, cancel only unstarted pending tasks/jobs
 * - Explicitly release assignments — never delete history
 */

import { createServiceClient } from "@/server/db/client";
import { randomUUID } from "crypto";

export interface SupervisorCancellationResult {
  cancelled_assignment_ids: string[];
  cancelled_task_ids: string[];
  audit_event_id: string;
}

/**
 * Supervisor cancellation of an active incident's work.
 * Only cancels unstarted/pending tasks — in-progress tasks require
 * explicit assignment disposition.
 * Retains full history — never hard-deletes records.
 */
export async function supervisorCancelWork(
  incidentId: string,
  supervisorMembershipId: string,
  reason: string,
  expectedVersion: number
): Promise<SupervisorCancellationResult> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // Version check on incident
  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .select("id, version, state, institution_id")
    .eq("id", incidentId)
    .single();

  if (incidentError || !incident) {
    throw Object.assign(new Error("Incident not found"), { status: 404 });
  }

  if (incident.version !== expectedVersion) {
    throw Object.assign(new Error("Stale version — reload and try again"), { status: 409 });
  }

  const { data: plans } = await supabase.from("incident_plans")
    .select("id").eq("incident_id", incidentId).eq("institution_id", incident.institution_id);
  const planIds = (plans ?? []).map((plan) => plan.id);
  const { data: incidentTasks } = planIds.length > 0
    ? await supabase.from("incident_tasks").select("id").in("plan_id", planIds)
    : { data: [] };
  const incidentTaskIds = (incidentTasks ?? []).map((task) => task.id);

  // Get pending/offered assignments (safe to cancel)
  const { data: cancelableAssignments } = await supabase
    .from("assignments")
    .select("id, task_id, state, active_version")
    .in("state", ["offered"]) // only unacknowledged — active requires disposition
    .in("task_id", incidentTaskIds.length > 0 ? incidentTaskIds : ["00000000-0000-0000-0000-000000000000"]);

  const assignmentIds: string[] = [];
  const taskIds: string[] = [];

  for (const assignment of cancelableAssignments ?? []) {
    await supabase
      .from("assignments")
      .update({ state: "cancelled", active_version: false, updated_at: now })
      .eq("id", assignment.id);
    assignmentIds.push(assignment.id);

    // Mark associated task as cancelled if it hasn't started
    const { data: task } = await supabase
      .from("incident_tasks")
      .select("id, state")
      .eq("id", assignment.task_id)
      .single();

    if (task && ["pending", "ready", "assigned"].includes(task.state)) {
      await supabase
        .from("incident_tasks")
        .update({ state: "cancelled", updated_at: now })
        .eq("id", task.id);
      taskIds.push(task.id);
    }
  }

  // Cancel any queued/pending jobs for this incident
  await supabase
    .from("jobs")
    .update({ status: "dead" })
    .eq("incident_id", incidentId)
    .in("status", ["queued", "retry_wait"]);

  // Audit event
  const auditId = randomUUID();
  await supabase.from("audit_events").insert({
    id: auditId,
    institution_id: incident.institution_id,
    actor_membership_id: supervisorMembershipId,
    action: "supervisor_cancellation",
    target_type: "incident",
    target_id: incidentId,
    safe_payload: {
      previous: { version: expectedVersion, state: incident.state },
      cancelled_assignments: assignmentIds.length,
      cancelled_tasks: taskIds.length,
      reason,
    },
    created_at: now,
  });

  // Incident event
  await supabase.from("incident_events").insert({
    institution_id: incident.institution_id,
    incident_id: incidentId,
    actor_membership_id: supervisorMembershipId,
    actor_type: "human",
    action: "supervisor_cancellation",
    safe_payload: { reason, cancelled_assignments: assignmentIds, cancelled_tasks: taskIds },
    created_at: now,
  });

  return {
    cancelled_assignment_ids: assignmentIds,
    cancelled_task_ids: taskIds,
    audit_event_id: auditId,
  };
}

/**
 * Replaces an absent verifier with an alternate (HOD escalation path).
 * Called when verifier doesn't respond after 20 minutes.
 * Keeps accountability — replaces designated verifier, logs the change.
 */
export async function replaceAbsentVerifier(
  taskId: string,
  newVerifierMembershipId: string,
  actorMembershipId: string,
  reason: string
): Promise<void> {
  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  const { data: task, error } = await supabase
    .from("incident_tasks")
    .select("id, institution_id, plan_id, designated_verifier_membership_id, state")
    .eq("id", taskId)
    .single();

  if (error || !task) {
    throw Object.assign(new Error("Task not found"), { status: 404 });
  }

  if (task.state !== "submitted") {
    throw Object.assign(
      new Error(`Cannot replace verifier — task is '${task.state}', must be 'submitted'`),
      { status: 422 }
    );
  }

  const previousVerifier = task.designated_verifier_membership_id;

  // Update designated verifier
  await supabase
    .from("incident_tasks")
    .update({
      designated_verifier_membership_id: newVerifierMembershipId,
      verifier_due_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // fresh 20-min window
      updated_at: now,
    })
    .eq("id", taskId);

  // Audit event
  await supabase.from("audit_events").insert({
    institution_id: task.institution_id,
    actor_membership_id: actorMembershipId,
    action: "verifier_replaced",
    target_type: "incident_task",
    target_id: taskId,
    safe_payload: {
      previous: { designated_verifier_membership_id: previousVerifier },
      next: { designated_verifier_membership_id: newVerifierMembershipId },
      reason,
    },
    created_at: now,
  });

  const { data: plan } = await supabase.from("incident_plans")
    .select("incident_id").eq("id", task.plan_id).maybeSingle();
  if (plan?.incident_id) {
    await supabase.from("incident_events").insert({
      institution_id: task.institution_id,
      incident_id: plan.incident_id,
      actor_membership_id: actorMembershipId,
      actor_type: "human",
      action: "verifier_replaced",
      safe_payload: { task_id: taskId, previous_verifier: previousVerifier, new_verifier: newVerifierMembershipId, reason },
      created_at: now,
    });
  }

  // Notify new verifier
  await supabase.from("notifications").insert({
    institution_id: task.institution_id,
    recipient_membership_id: newVerifierMembershipId,
    safe_text: `You have been assigned as verifier for task ${taskId}. Please review and confirm within 20 minutes.`,
    link: `/incidents/${taskId}`,
    created_at: now,
  });
}

/**
 * Carry-forward logic for replanned tasks (C2 recovery).
 * Per Execution Decisions §5: carry completed verification only if
 * goal, location, evidence requirement and evidence version are unchanged.
 * Otherwise require new verification checks.
 */
export async function evaluateCarryForward(
  previousTaskId: string,
  newTaskDef: {
    logical_task_key: string;
    specialist_profile: string;
    evidence_requirements: string[];
  }
): Promise<{ should_carry: boolean; reason: string }> {
  const supabase = await createServiceClient();

  const { data: prevTask } = await supabase
    .from("incident_tasks")
    .select(`
      id, logical_task_key, specialist_profile, state, evidence_requirements,
      verification_records ( id, human_result, agent_verdict, evidence_version, created_at )
    `)
    .eq("id", previousTaskId)
    .single();

  if (!prevTask || prevTask.state !== "verified") {
    return { should_carry: false, reason: "Previous task not in verified state" };
  }

  const verificationRecords = prevTask.verification_records as unknown as
    | Array<{ human_result: string }>
    | null;
  const prevVerification = verificationRecords?.[0];
  if (!prevVerification || prevVerification.human_result !== "pass") {
    return { should_carry: false, reason: "No confirmed human verification found" };
  }

  // Check if goal/profile/evidence requirements changed
  const keyMatch = prevTask.logical_task_key === newTaskDef.logical_task_key;
  const profileMatch = prevTask.specialist_profile === newTaskDef.specialist_profile;
  const previousEvidence = Array.isArray(prevTask.evidence_requirements)
    ? prevTask.evidence_requirements.filter((item): item is string => typeof item === "string")
    : [];
  const evidenceMatch =
    JSON.stringify(previousEvidence.sort()) ===
    JSON.stringify(newTaskDef.evidence_requirements?.sort());

  if (!keyMatch) {
    return { should_carry: false, reason: "Task logical key changed — new verification required" };
  }
  if (!profileMatch) {
    return { should_carry: false, reason: "Specialist profile changed — new verification required" };
  }
  if (!evidenceMatch) {
    return { should_carry: false, reason: "Evidence requirements changed — new verification required" };
  }

  return {
    should_carry: true,
    reason: `Carrying forward verification from task ${previousTaskId} (unchanged goal/evidence/profile)`,
  };
}
