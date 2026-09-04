/**
 * ORION Operations — Staff Availability Domain Service
 * Developer 4 (Anjali) owns this file.
 *
 * Manages staff self-availability: Available / Busy / Off duty.
 * This is SEPARATE from admin-controlled Active/Inactive membership status.
 *
 * Key rules (from master plan §8):
 * - Active + Available + correct skill/zone + capacity: eligible for routine work
 * - Busy: excluded from routine work; urgent work requires supervisor approval
 * - Off duty: never eligible for new work
 * - Off duty with open tasks: must choose Keep or Request Handover
 * - Persist state, timestamp, and audit event on every change
 */

import { createClient } from "@/server/db/client";
import type {
  AvailabilityState,
  AvailabilityUpdateRequest,
  Assignment,
} from "@/contracts/operations";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";

export interface AvailabilityUpdateResult {
  new_state: AvailabilityState;
  capability_version: number;
  open_tasks: Assignment[];
  handover_created: boolean;
}

/**
 * Updates a staff member's self-availability state.
 * Validates the transition, handles open tasks, emits an audit event.
 *
 * Throws with .status for HTTP routing.
 */
export async function updateAvailability(
  membershipId: string,
  institutionId: string,
  request: AvailabilityUpdateRequest
): Promise<AvailabilityUpdateResult> {
  const supabase = await createClient();

  // 1. Fetch current capability record
  const { data: cap, error: capError } = await supabase
    .from("staff_capabilities")
    .select("id, availability, workload_limit, version, updated_at")
    .eq("membership_id", membershipId)
    .single();

  if (capError || !cap) {
    throw Object.assign(new Error("Staff capability record not found"), {
      status: 404,
    });
  }

  // 2. Optimistic version check against the canonical integer version.
  if (request.expected_version !== cap.version) {
    throw Object.assign(
      new Error("Stale availability record — reload and try again"),
      { status: 409 }
    );
  }

  // 3. Check for open assignments when going Off duty
  const openTasks = await getOpenAssignments(supabase, membershipId);

  if (request.state === "off_duty" && openTasks.length > 0) {
    if (!request.open_task_choice) {
      // Return the open tasks — client must present choice modal
      throw Object.assign(
        new Error("Staff has open tasks — choose 'keep' or 'handover'"),
        { status: 409, open_tasks: openTasks }
      );
    }
  }

  const now = new Date().toISOString();

  // 4. Persist new availability state
  const { error: updateError } = await supabase
    .from("staff_capabilities")
    .update({
      availability: request.state,
      updated_by: membershipId,
      version: cap.version + 1,
      updated_at: now,
    })
    .eq("membership_id", membershipId)
    .eq("version", request.expected_version);

  if (updateError) {
    throw Object.assign(
      new Error(`Failed to update availability: ${updateError.message}`),
      { status: 500 }
    );
  }

  // 5. Handle handover choice
  let handoverCreated = false;
  if (
    request.state === "off_duty" &&
    request.open_task_choice === "handover" &&
    openTasks.length > 0
  ) {
    await createHandoverEvents(supabase, institutionId, membershipId, openTasks, request.reason);
    handoverCreated = true;
  }

  // 6. Emit audit event
  await supabase.from("audit_events").insert({
    institution_id: institutionId,
    actor_membership_id: membershipId,
    action: "staff_availability_changed",
    target_type: "staff_capability",
    target_id: cap.id,
    safe_payload: {
      previous: { availability: cap.availability },
      next: { availability: request.state },
      reason: request.reason ?? null,
    },
    created_at: now,
  });

  return {
    new_state: request.state,
    capability_version: cap.version + 1,
    open_tasks: openTasks,
    handover_created: handoverCreated,
  };
}

/**
 * Returns open (non-cancelled, non-completed) assignments for a staff member.
 */
export async function getOpenAssignments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  membershipId: string
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("id, task_id, assignee_membership_id, state, acknowledgement_deadline, version, active_version, created_at, updated_at")
    .eq("assignee_membership_id", membershipId)
    .in("state", ["offered", "acknowledged", "active"]);

  if (error) return [];
  return (data ?? []) as Assignment[];
}

/**
 * Creates handover events for D1's replan/Commander loop.
 * Keeps accountable owner until replacement accepts — never drops a task.
 */
async function createHandoverEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  institutionId: string,
  membershipId: string,
  assignments: Assignment[],
  reason?: string
) {
  const now = new Date().toISOString();

  for (const assignment of assignments) {
    const { data: task } = await supabase.from("incident_tasks").select("plan_id")
      .eq("id", assignment.task_id).eq("institution_id", institutionId).maybeSingle();
    const { data: plan } = task
      ? await supabase.from("incident_plans").select("incident_id").eq("id", task.plan_id).maybeSingle()
      : { data: null };
    if (!plan?.incident_id) continue;
    // Mark assignment as handover_requested
    await supabase
      .from("assignments")
      .update({ state: "handover_requested", updated_at: now })
      .eq("id", assignment.id);

    // Queue a handover job for D1's runner
    await enqueueCommanderJob(
      plan.incident_id,
      reason ?? `Assignment ${assignment.id} requires handover because staff went off duty`,
      `availability-handover-${assignment.id}`,
    );

    // Append incident event
    await supabase.from("incident_events").insert({
      institution_id: institutionId,
      incident_id: plan.incident_id,
      actor_membership_id: membershipId,
      actor_type: "human",
      action: "handover_requested",
      safe_payload: {
        assignment_id: assignment.id,
        reason: reason ?? "Staff went off duty",
        triggered_by: "availability_change",
      },
      created_at: now,
    });
  }
}

/**
 * Returns the current availability state of a staff member.
 */
export async function getAvailability(membershipId: string): Promise<{
  state: AvailabilityState;
  version: number;
  workload_limit: number;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_capabilities")
    .select("availability, workload_limit, version")
    .eq("membership_id", membershipId)
    .single();

  if (error || !data) return null;

  return {
    state: data.availability as AvailabilityState,
    version: data.version as number,
    workload_limit: data.workload_limit as number,
  };
}
