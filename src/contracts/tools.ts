import { z } from "zod";

export const TOOL_NAMES = [
  "getIncidentContext", "findRelatedIncidents", "getEligibleStaff", "createPlanVersion",
  "assignTask", "queueEmail", "requestEvidence", "requestApproval", "escalateIncident",
  "recordVerification",
] as const;

export const toolNameSchema = z.enum(TOOL_NAMES);
export type ToolName = z.infer<typeof toolNameSchema>;

export const toolCallSchema = z.object({
  name: toolNameSchema,
  arguments: z.record(z.string(), z.unknown()),
}).strict();

export type ToolCall = z.infer<typeof toolCallSchema>;

export const AGENT_TOOL_ALLOWLIST: Record<string, readonly ToolName[]> = {
  triage: ["getIncidentContext", "findRelatedIncidents"],
  commander: ["getIncidentContext", "getEligibleStaff", "createPlanVersion", "requestApproval", "escalateIncident"],
  specialist: ["getEligibleStaff", "assignTask", "queueEmail", "requestEvidence", "requestApproval"],
  verification: ["getIncidentContext", "requestEvidence", "recordVerification", "escalateIncident"],
};
