import { createServiceClient } from "@/server/db/client";
import type {
  Assignment,
  AssignmentState,
  TaskState,
  AssignmentActionRequest,
} from "@/contracts/operations";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";
import type { TablesUpdate } from "@/contracts/database";

const VALID_TRANSITIONS: Record<AssignmentState, string[]> = {
  offered: ["acknowledge"],
  acknowledged: ["start"],
  active: ["block", "submit", "handover"],
  handover_requested: [],
  released: [],
  completed: [],
  cancelled: [],
};

function resolveStates(action: string): {
  newAssignmentState: AssignmentState;
  newTaskState: TaskState | null;
} {
  switch (action) {
    case "acknowledge":
      return { newAssignmentState: "acknowledged", newTaskState: "acknowledged" };
    case "start":
      return { newAssignmentState: "active", newTaskState: "in_progress" };
    case "block":
      return { newAssignmentState: "active", newTaskState: "blocked" };
    case "submit":
      return { newAssignmentState: "completed", newTaskState: "submitted" };
    case "handover":
      return { newAssignmentState: "handover_requested", newTaskState: null };
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export async function performAssignmentAction(
  assignmentId: string,
  membershipId: string,
  request: AssignmentActionRequest
): Promise<Assignment> {
  const db = await createServiceClient();

  // 1. Try database RPC if deployed
  try {
    const { data: rpcData, error: rpcError } = await db.rpc("orion_assignment_action", {
      target_id: assignmentId,
      actor_id: membershipId,
      expected_version: request.expected_version,
      requested_action: request.action,
      reason: request.reason ?? request.block_reason ?? undefined,
    });

    if (!rpcError && rpcData) {
      const assignment = rpcData as unknown as Assignment;
      if (request.action === "handover" || request.action === "block") {
        const { data: task } = await db.from("incident_tasks").select("plan_id").eq("id", assignment.task_id).single();
        const { data: plan } = await db.from("incident_plans").select("incident_id").eq("id", task!.plan_id).single();
        await enqueueCommanderJob(plan!.incident_id, request.reason ?? request.block_reason ?? "Staff requested handover", "handover-" + assignment.id + "-v" + assignment.version);
      }
      return assignment;
    }
  } catch {
    // Fall through to resilient TypeScript implementation
  }

  // 2. Resilient TypeScript implementation
  const { data: current, error: fetchError } = await db
    .from("assignments")
    .select("id, assignee_membership_id, state, version, active_version, task_id, institution_id")
    .eq("id", assignmentId)
    .single();

  if (fetchError || !current || current.assignee_membership_id !== membershipId) {
    throw Object.assign(new Error("Assignment not found or not authorized"), { status: 404 });
  }

  const { data: task } = await db.from("incident_tasks")
    .select("id, plan_id, evidence_version, state, specialist_profile, goal, logical_task_key")
    .eq("id", current.task_id)
    .eq("institution_id", current.institution_id)
    .maybeSingle();

  const { data: plan } = task
    ? await db.from("incident_plans").select("incident_id, status").eq("id", task.plan_id).maybeSingle()
    : { data: null };

  if (!plan?.incident_id) {
    throw Object.assign(new Error("Assignment incident context not found"), { status: 404 });
  }

  if (!current.active_version || current.version !== request.expected_version) {
    throw Object.assign(
      new Error("Stale version — assignment was modified. Reload and try again."),
      { status: 409, currentVersion: current.version }
    );
  }

  const allowed = VALID_TRANSITIONS[current.state as AssignmentState] ?? [];
  if (!allowed.includes(request.action)) {
    throw Object.assign(
      new Error(`Cannot '${request.action}' an assignment in state '${current.state}'`),
      { status: 422 }
    );
  }

  const { newAssignmentState, newTaskState } = resolveStates(request.action);
  const newVersion = current.version + 1;

  // Validate completion evidence exists before submitting
  if (request.action === "submit") {
    const { data: evidenceList } = await db.from("resolution_evidence")
      .select("kind")
      .eq("task_id", current.task_id)
      .eq("evidence_version", task?.evidence_version ?? 1);

    const kinds = new Set((evidenceList ?? []).map((e) => e.kind));
    if (!kinds.has("note")) {
      throw Object.assign(new Error("Completion notes are required"), { status: 422 });
    }
    if (!kinds.has("test_result")) {
      throw Object.assign(new Error("Functional test results are required"), { status: 422 });
    }
  }

  const { data: updated, error: updateError } = await db
    .from("assignments")
    .update({
      state: newAssignmentState,
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("version", request.expected_version)
    .eq("active_version", true)
    .select()
    .single();

  if (updateError || !updated) {
    throw Object.assign(new Error("Update failed — possible concurrent edit"), { status: 409 });
  }

  if (newTaskState) {
    const taskUpdate: TablesUpdate<"incident_tasks"> = {
      state: newTaskState,
      updated_at: new Date().toISOString(),
    };
    if (request.action === "submit") {
      taskUpdate.verifier_due_at = new Date(Date.now() + 20 * 60_000).toISOString();
    }
    await db.from("incident_tasks").update(taskUpdate).eq("id", current.task_id);
  }

  // Incident state transitions
  if (request.action === "start") {
    await db.from("incidents").update({
      state: "in_progress",
      updated_at: new Date().toISOString(),
    }).eq("id", plan.incident_id);
  } else if (request.action === "submit") {
    const { data: inc } = await db.from("incidents").select("version").eq("id", plan.incident_id).single();
    await db.from("incidents").update({
      state: "submitted_for_verification",
      version: (inc?.version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", plan.incident_id);

    await db.from("jobs").insert({
      institution_id: current.institution_id,
      incident_id: plan.incident_id,
      type: "verification",
      dedupe_key: `verification:${current.task_id}:e${task?.evidence_version ?? 1}`,
      payload: { taskId: current.task_id, evidenceVersion: task?.evidence_version ?? 1 },
      due_at: new Date().toISOString(),
    });
  }

  if (request.action === "handover" || request.action === "block") {
    await enqueueCommanderJob(
      plan.incident_id,
      request.reason ?? request.block_reason ?? "Staff requested handover",
      `handover-${assignmentId}-v${newVersion}`
    );
  }

  await db.from("incident_events").insert({
    institution_id: current.institution_id,
    incident_id: plan.incident_id,
    actor_membership_id: membershipId,
    actor_type: "human",
    action: `assignment_${request.action}`,
    safe_payload: { assignmentId, reason: request.reason ?? request.block_reason ?? null, newState: newAssignmentState },
  });

  return updated as unknown as Assignment;
}
