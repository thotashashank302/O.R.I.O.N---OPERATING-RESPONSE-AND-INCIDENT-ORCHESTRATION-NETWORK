import type { IncidentContext } from "@/contracts/domain";

/** Unknown and physical categories fail closed; ordinary 'other' work is the only exception. */
export function requiresHumanApproval(incident: Pick<IncidentContext, "category" | "visibility" | "severityFloor">): boolean {
  return incident.category !== "other" || incident.visibility !== "routine"
    || ["high", "critical"].includes(incident.severityFloor);
}
