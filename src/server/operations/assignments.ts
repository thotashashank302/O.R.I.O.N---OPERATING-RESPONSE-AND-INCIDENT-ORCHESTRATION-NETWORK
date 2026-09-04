/**
 * ORION Operations — Assignment Domain Service
 * Developer 4 (Anjali) owns this file.
 *
 * Fetches staff assignments scoped to the requesting member only.
 * Never exposes private case details or cross-department assignments.
 */

import { createClient } from "@/server/db/client";
import type { Assignment, IncidentState, TaskState } from "@/contracts/operations";

interface AssignmentTaskRow {
  id: string;
  plan_id: string;
  logical_task_key: string;
  specialist_profile: string;
  checklist: string[] | null;
  state: TaskState;
  evidence_requirements: string[] | null;
  requires_approval: boolean | null;
  designated_verifier_membership_id: string | null;
  verifier_due_at: string | null;
  incident_plans?: {
    incident?: {
      id: string;
      category: string;
      severity: "critical" | "high" | "normal" | "low";
      state: IncidentState;
      version: number;
      campus_locations?: { label: string | null } | null;
    } | null;
  } | null;
}

interface AssignmentRow {
  id: string;
  task_id: string;
  assignee_membership_id: string;
  state: Assignment["state"];
  acknowledgement_deadline: string | null;
  version: number;
  active_version: boolean;
  created_at: string;
  updated_at: string;
  task: AssignmentTaskRow | null;
}

/**
 * Returns all non-cancelled assignments for the given membership.
 * Enforces row-level scope: only assignments where assignee_membership_id = membershipId.
 */
export async function getStaffAssignments(
  membershipId: string,
  institutionId: string
): Promise<Assignment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      task_id,
      assignee_membership_id,
      state,
      acknowledgement_deadline,
      version,
      active_version,
      created_at,
      updated_at,
      task:incident_tasks (
        id,
        plan_id,
        logical_task_key,
        specialist_profile,
        checklist,
        state,
        evidence_requirements,
        requires_approval,
        designated_verifier_membership_id,
        verifier_due_at,
        incident_plans (
          incident:incidents (
            id,
            category,
            severity,
            state,
            version,
            campus_locations ( label )
          )
        )
      )
    `
    )
    .eq("institution_id", institutionId)
    .eq("assignee_membership_id", membershipId)
    .neq("state", "cancelled")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch assignments: ${error.message}`);
  }

  // Map nested join to flat shape expected by contract
  const rows = (data ?? []) as unknown as AssignmentRow[];
  return rows.map((row) => {
    const task = row.task;
    const plan = task?.incident_plans;
    const incident = plan?.incident;
    return {
      id: row.id,
      task_id: row.task_id,
      assignee_membership_id: row.assignee_membership_id,
      state: row.state,
      acknowledgement_deadline: row.acknowledgement_deadline,
      version: row.version,
      active_version: row.active_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      task: task
        ? {
            id: task.id,
            plan_id: task.plan_id,
            logical_task_key: task.logical_task_key,
            specialist_profile: task.specialist_profile,
            checklist: task.checklist ?? [],
            state: task.state,
            evidence_requirements: task.evidence_requirements ?? [],
            requires_approval: task.requires_approval ?? false,
            depends_on: [],
            designated_verifier_membership_id:
              task.designated_verifier_membership_id ?? null,
            verifier_due_at: task.verifier_due_at ?? null,
          }
        : undefined,
      incident: incident
        ? {
            id: incident.id,
            title: `${incident.category} — ${incident.campus_locations?.label ?? "Unknown location"}`,
            category: incident.category,
            severity: incident.severity,
            location_label: incident.campus_locations?.label ?? "",
            state: incident.state,
            version: incident.version,
          }
        : undefined,
    };
  });
}

/**
 * Returns a single assignment by ID, only if it belongs to the given membership.
 * Returns null if not found or not authorized.
 */
export async function getAssignment(
  assignmentId: string,
  membershipId: string
): Promise<Assignment | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      task_id,
      assignee_membership_id,
      state,
      acknowledgement_deadline,
      version,
      active_version,
      created_at,
      updated_at,
      task:incident_tasks (
        id,
        plan_id,
        logical_task_key,
        specialist_profile,
        checklist,
        state,
        evidence_requirements,
        requires_approval,
        designated_verifier_membership_id,
        verifier_due_at
      )
    `
    )
    .eq("id", assignmentId)
    .eq("assignee_membership_id", membershipId)
    .single();

  if (error || !data) return null;

  const task = (data as unknown as AssignmentRow).task;
  return {
    id: data.id,
    task_id: data.task_id,
    assignee_membership_id: data.assignee_membership_id,
    state: data.state,
    acknowledgement_deadline: data.acknowledgement_deadline,
    version: data.version,
    active_version: data.active_version,
    created_at: data.created_at,
    updated_at: data.updated_at,
    task: task
      ? {
          id: task.id,
          plan_id: task.plan_id,
          logical_task_key: task.logical_task_key,
          specialist_profile: task.specialist_profile,
          checklist: task.checklist ?? [],
          state: task.state,
          evidence_requirements: task.evidence_requirements ?? [],
          requires_approval: task.requires_approval ?? false,
          depends_on: [],
          designated_verifier_membership_id:
            task.designated_verifier_membership_id ?? null,
          verifier_due_at: task.verifier_due_at ?? null,
        }
      : undefined,
  };
}
