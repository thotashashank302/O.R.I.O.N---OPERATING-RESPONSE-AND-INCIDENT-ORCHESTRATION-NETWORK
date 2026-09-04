import type { IncidentState } from "@/contracts/domain";

const transitions: Record<IncidentState, readonly IncidentState[]> = {
  reported: ["triaging", "cancelled", "escalated"],
  triaging: ["needs_clarification", "planned", "escalated", "cancelled"],
  needs_clarification: ["triaging", "cancelled", "escalated"],
  planned: ["awaiting_approval", "assigned", "cancelled", "escalated"],
  awaiting_approval: ["assigned", "planned", "cancelled", "escalated"],
  assigned: ["acknowledged", "planned", "cancelled", "escalated"],
  acknowledged: ["in_progress", "planned", "cancelled", "escalated"],
  in_progress: ["submitted_for_verification", "planned", "cancelled", "escalated"],
  submitted_for_verification: ["resolved", "planned", "reopened", "escalated"],
  resolved: ["reopened"],
  reopened: ["triaging", "planned", "escalated"],
  escalated: ["planned", "cancelled"],
  cancelled: [],
};

export function assertIncidentTransition(from: IncidentState, to: IncidentState): void {
  if (!transitions[from].includes(to)) throw new Error(`Invalid incident transition: ${from} -> ${to}`);
}

export interface CancellationFacts {
  visibility: "routine" | "restricted" | "confidential";
  reporterOwnsIncident: boolean;
  hasActiveAssignment: boolean;
  hasDependentLinkedReports: boolean;
}

export function cancellationDecision(facts: CancellationFacts): "allow" | "approval_required" | "deny" {
  if (!facts.reporterOwnsIncident) return "deny";
  if (facts.visibility !== "routine" || facts.hasActiveAssignment || facts.hasDependentLinkedReports) return "approval_required";
  return "allow";
}

export interface DuplicateFacts {
  sameInstitution: boolean;
  sameScope: boolean;
  confidential: boolean;
  wouldCycle: boolean;
  eitherHasActiveWork: boolean;
}

export function duplicateLinkDecision(facts: DuplicateFacts): "allow" | "reconcile" | "deny" {
  if (!facts.sameInstitution || !facts.sameScope || facts.confidential || facts.wouldCycle) return "deny";
  return facts.eitherHasActiveWork ? "reconcile" : "allow";
}

export function canReopen(resolvedAt: Date, now = new Date()): boolean {
  return now.getTime() - resolvedAt.getTime() <= 24 * 60 * 60 * 1000;
}
