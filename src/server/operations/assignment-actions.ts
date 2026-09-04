/**
 * ORION Operations — Assignment Actions Domain Service
 * Developer 4 (Anjali) owns this file.
 *
 * Handles acknowledge / start / block / submit / handover transitions.
 * Uses optimistic locking (expected_version) for all mutations.
 * The shared acknowledge path is callable by D5's email confirmation service.
 */

import { createClient } from "@/server/db/client";
import type {
  Assignment,
  AssignmentState,
  TaskState,
  AssignmentActionRequest,
} from "@/contracts/operations";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";

// Valid transition map: current state -> allowed actions
const VALID_TRANSITIONS: Record<AssignmentState, string[]> = {
  offered: ["acknowledge"],
  acknowledged: ["start"],
  active: ["block", "submit", "handover"],
  handover_requested: [],
  released: [],
  completed: [],
  cancelled: [],
};

/**
 * Performs an assignment state transition.
 * Returns the updated assignment or throws with a descriptive error.
 *
 * This is the SHARED acknowledge entry point used by D5's email confirmation.
 * It enforces: same assignment, same version, correct current state.
 */
export async function performAssignmentAction(
  assignmentId: string,
  membershipId: string,
  request: AssignmentActionRequest
): Promise<Assignment> {
  const supabase = await createClient();

  // 1. Fetch current assignment — must belong to this member
  const { data: current, error: fetchError } = await supabase
    .from("assignments")
    .select("id, assignee_membership_id, state, version, active_version, task_id, institution_id")
    .eq("id", assignmentId)
    .eq("assignee_membership_id", membershipId)
    .single();

  if (fetchError || !current) {
    throw Object.assign(new Error("Assignment not found or not authorized"), {
      status: 404,
    });
  }

  const { data: task } = await supabase.from("incident_tasks")
    .select("plan_id").eq("id", current.task_id).eq("institution_id", current.institution_id).maybeSingle();
  const { data: plan } = task
    ? await supabase.from("incident_plans").select("incident_id").eq("id", task.plan_id).maybeSingle()
    : { data: null };
  if (!plan?.incident_id) {
    throw Object.assign(new Error("Assignment incident context not found"), { status: 404 });
  }

  // 2. Optimistic version check
  if (!current.active_version || current.version !== request.expected_version) {
    throw Object.assign(
      new Error(
        "Stale version — assignment was modified. Reload and try again."
      ),
      { status: 409, currentVersion: current.version }
    );
  }

  // 3. Validate transition
  const allowed = VALID_TRANSITIONS[current.state as AssignmentState] ?? [];
  if (!allowed.includes(request.action)) {
    throw Object.assign(
      new Error(
        `Cannot '${request.action}' an assignment in state '${current.state}'`
      ),
      { status: 422 }
    );
  }

  // 4. Map action -> new assignment state and task state
  const { newAssignmentState, newTaskState } = resolveStates(request.action);
  const newVersion = current.version + 1;

  // 5. Atomic update: assignment + task state in one transaction-like batch
  const { data: updated, error: updateError } = await supabase
    .from("assignments")
    .update({
      state: newAssignmentState,
      version: newVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assignmentId)
    .eq("version", request.expected_version)
    .eq("active_version", true) // double-check for race and superseded assignment
    .select()
    .single();

  if (updateError || !updated) {
    // Could be a race condition — check if version changed
    throw Object.assign(new Error("Update failed — possible concurrent edit"), {
      status: 409,
    });
  }

  // 6. Update task state
  if (newTaskState) {
    await supabase
      .from("incident_tasks")
      .update({ state: newTaskState, updated_at: new Date().toISOString() })
      .eq("id", current.task_id);
  }

  // 7. If handover: create a handover event for D1's replan loop
  if (request.action === "handover") {
    await recordHandoverEvent(
      supabase,
      current.institution_id,
      plan.incident_id,
      assignmentId,
      membershipId,
      request.reason
    );
  }

  // 8. Append to incident_events
  await appendIncidentEvent(supabase, {
    assignment_id: assignmentId,
    institution_id: current.institution_id,
    incident_id: plan.incident_id,
    actor_membership_id: membershipId,
    action: request.action,
    reason: request.reason ?? request.block_reason ?? null,
    new_state: newAssignmentState,
  });

  return updated as Assignment;
}

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

async function recordHandoverEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  institutionId: string,
  incidentId: string,
  assignmentId: string,
  membershipId: string,
  reason?: string
) {
  // Creates an event for D1's replan/Commander loop to pick up
  await enqueueCommanderJob(
    incidentId,
    reason ?? `Assignment ${assignmentId} requires handover`,
    `handover-${assignmentId}`,
  );
}

async function appendIncidentEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: {
    assignment_id: string;
    institution_id: string;
    incident_id: string;
    actor_membership_id: string;
    action: string;
    reason: string | null;
    new_state: string;
  }
) {
  await supabase.from("incident_events").insert({
    institution_id: event.institution_id,
    incident_id: event.incident_id,
    actor_membership_id: event.actor_membership_id,
    actor_type: "human",
    action: event.action,
    safe_payload: { assignment_id: event.assignment_id, new_state: event.new_state, reason: event.reason },
    created_at: new Date().toISOString(),
  });
}
