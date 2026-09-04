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
    .select("id, availability, workload_limit, updated_at")
    .eq("membership_id", membershipId)
    .single();

  if (capError || !cap) {
    throw Object.assign(new Error("Staff capability record not found"), {
      status: 404,
    });
  }

  // 2. Version check (using updated_at as optimistic lock proxy until D1 adds version column)
  // expected_version encodes as epoch seconds of updated_at
  const currentEpoch = Math.floor(
    new Date(cap.updated_at as string).getTime() / 1000
  );
  if (request.expected_version !== currentEpoch) {
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
      updated_at: now,
    })
    .eq("membership_id", membershipId);

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
    await createHandoverEvents(supabase, membershipId, openTasks, request.reason);
    handoverCreated = true;
  }

  // 6. Emit audit event
  await supabase.from("audit_events").insert({
    actor_membership_id: membershipId,
    entity_type: "staff_capability",
    entity_id: cap.id,
    previous_value: { availability: cap.availability },
    new_value: { availability: request.state },
    reason: request.reason ?? null,
    created_at: now,
  });

  const newEpoch = Math.floor(new Date(now).getTime() / 1000);

  return {
    new_state: request.state,
    capability_version: newEpoch,
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
    .select("id, task_id, assignee_membership_id, state, acknowledgement_deadline, active_version, created_at, updated_at")
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
  membershipId: string,
  assignments: Assignment[],
  reason?: string
) {
  const now = new Date().toISOString();

  for (const assignment of assignments) {
    // Mark assignment as handover_requested
    await supabase
      .from("assignments")
      .update({ state: "handover_requested", updated_at: now })
      .eq("id", assignment.id);

    // Queue a handover job for D1's runner
    await supabase.from("jobs").insert({
      type: "handover_requested",
      payload: {
        assignment_id: assignment.id,
        requester_membership_id: membershipId,
        reason: reason ?? "Staff went off duty",
        triggered_by: "availability_change",
      },
      status: "queued",
      due_at: now,
      attempt: 0,
      dedupe_key: `availability-handover-${assignment.id}-${Date.now()}`,
    });

    // Append incident event
    await supabase.from("incident_events").insert({
      entity_type: "assignment",
      entity_id: assignment.id,
      actor_membership_id: membershipId,
      event_type: "handover_requested",
      payload: {
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
    .select("availability, workload_limit, updated_at")
    .eq("membership_id", membershipId)
    .single();

  if (error || !data) return null;

  return {
    state: data.availability as AvailabilityState,
    version: Math.floor(new Date(data.updated_at as string).getTime() / 1000),
    workload_limit: data.workload_limit as number,
  };
}
