/**
 * ORION Operations Contracts — Developer 4 (Anjali)
 * Shared types for operations, staff availability, assignments, evidence and verification.
 * D1 owns changes to this file after initial creation.
 */

// ─────────────────────────────────────────────
// Enums matching database status contracts
// ─────────────────────────────────────────────

export type AvailabilityState = "available" | "busy" | "off_duty";
export type MembershipState = "active" | "inactive";

export type AssignmentState =
  | "offered"
  | "acknowledged"
  | "active"
  | "handover_requested"
  | "released"
  | "completed"
  | "cancelled";

export type TaskState =
  | "pending"
  | "ready"
  | "assigned"
  | "acknowledged"
  | "in_progress"
  | "blocked"
  | "submitted"
  | "verified"
  | "failed"
  | "cancelled";

export type IncidentState =
  | "reported"
  | "triaging"
  | "needs_clarification"
  | "planned"
  | "awaiting_approval"
  | "assigned"
  | "acknowledged"
  | "in_progress"
  | "submitted_for_verification"
  | "resolved"
  | "reopened"
  | "escalated"
  | "cancelled";

export type EvidenceKind = "note" | "functional_test" | "photo_ref";
export type VerificationVerdict = "verified" | "failed" | "pending_human";

// ─────────────────────────────────────────────
// Core data shapes
// ─────────────────────────────────────────────

export interface StaffCapability {
  id: string;
  membership_id: string;
  skills: string[];
  zones: string[];
  availability: AvailabilityState;
  workload_limit: number;
  updated_by: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  task_id: string;
  assignee_membership_id: string;
  state: AssignmentState;
  acknowledgement_deadline: string | null;
  active_version: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  task?: Task;
  incident?: IncidentSummary;
}

export interface Task {
  id: string;
  plan_id: string;
  logical_task_key: string;
  specialist_profile: string;
  checklist: string[];
  state: TaskState;
  evidence_requirements: string[];
  requires_approval: boolean;
  depends_on: string[];
  designated_verifier_membership_id: string | null;
  verifier_deadline: string | null;
}

export interface IncidentSummary {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "normal" | "low";
  location_label: string;
  state: IncidentState;
  version: number;
}

export interface ResolutionEvidence {
  id: string;
  task_id: string;
  uploader_membership_id: string;
  kind: EvidenceKind;
  content: string;
  evidence_version: number;
  created_at: string;
}

export interface VerificationRecord {
  id: string;
  task_id: string;
  evidence_version: number;
  human_result: "confirmed" | "rejected" | "pending";
  agent_verdict: VerificationVerdict;
  reasons: string[];
  missing_evidence: string[];
  suggested_replan_reason: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  action_payload_hash: string;
  plan_version: number;
  approver_membership_id: string;
  decision: "approved" | "rejected";
  reason: string | null;
  decided_at: string;
}

export interface AuditEvent {
  id: string;
  actor_membership_id: string;
  entity_type: string;
  entity_id: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────
// API request / response shapes
// ─────────────────────────────────────────────

export interface AssignmentActionRequest {
  action: "acknowledge" | "start" | "block" | "submit" | "handover";
  expected_version: number;
  reason?: string;
  block_reason?: string;
}

export interface AvailabilityUpdateRequest {
  state: AvailabilityState;
  open_task_choice?: "keep" | "handover";
  expected_version: number;
  reason?: string;
}

export interface EvidenceSubmitRequest {
  kind: EvidenceKind;
  content: string;
  storage_key?: string;
  task_id: string;
  expected_assignment_version: number;
}

export interface ApprovalDecisionRequest {
  decision: "approve" | "reject";
  action_payload_hash: string;
  plan_version: number;
  reason?: string;
}

export interface OverrideRequest {
  reason: string;
  new_assignee_membership_id?: string;
  new_priority?: "critical" | "high" | "normal" | "low";
  expected_version: number;
}

// ─────────────────────────────────────────────
// Verification agent types
// ─────────────────────────────────────────────

export interface VerificationContext {
  task_id: string;
  task_logical_key: string;
  specialist_profile: string;
  checklist: string[];
  evidence_requirements: string[];
  submitted_evidence: ResolutionEvidence[];
  incident_category: string;
  requires_human_physical_check: boolean;
}

export interface VerificationDecision {
  task_id: string;
  verdict: VerificationVerdict;
  missing_evidence: string[];
  reasons: string[];
  suggested_replan_reason: string | null;
}

// ─────────────────────────────────────────────
// HTTP response wrappers
// ─────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}
