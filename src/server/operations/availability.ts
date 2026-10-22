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

import { createServiceClient } from "@/server/db/client";
import type {
  AvailabilityState,
  AvailabilityUpdateRequest,
  Assignment,
} from "@/contracts/operations";
import { throwPersistenceError } from "@/server/reporting/persistence-errors";

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
  const db = await createServiceClient();
  const { data, error } = await db.rpc("orion_set_availability", {
    actor_id: membershipId, tenant_id: institutionId, expected_version: request.expected_version,
    new_state: request.state, choice: request.open_task_choice, reason: request.reason,
  });
  if (error) throwPersistenceError(error);
  return data as unknown as AvailabilityUpdateResult;
}

/**
 * Returns open (non-cancelled, non-completed) assignments for a staff member.
 */
export async function getOpenAssignments(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
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
 * Returns the current availability state of a staff member.
 */
export async function getAvailability(membershipId: string): Promise<{
  state: AvailabilityState;
  version: number;
  workload_limit: number;
} | null> {
  const supabase = await createServiceClient();

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
