import { z } from "zod";
import { severitySchema } from "./domain";

export const AGENT_NAMES = ["triage", "commander", "specialist", "verification"] as const;
export const agentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof agentNameSchema>;

export const triageResultSchema = z.object({
  category: z.string().min(1),
  secondaryRisks: z.array(z.string()).max(8),
  locationId: z.string().uuid().nullable(),
  impactSummary: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  clarification: z.string().min(1).max(500).nullable(),
  duplicateCandidateIds: z.array(z.string().uuid()).max(10),
}).strict();

export const planTaskSchema = z.object({
  localId: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  logicalTaskKey: z.string().regex(/^[a-z0-9_-]{1,80}$/),
  profile: z.string().min(1).max(80),
  goal: z.string().min(1).max(500),
  dependsOn: z.array(z.string()).max(5),
  evidencePolicy: z.array(z.string()).min(1).max(8),
  requiresApproval: z.boolean(),
}).strict();

export const incidentPlanSchema = z.object({
  priority: severitySchema,
  explanation: z.string().min(1).max(1200),
  specialists: z.array(z.string().min(1)).min(1).max(5),
  tasks: z.array(planTaskSchema).min(1).max(5),
  acknowledgementMinutes: z.number().int().min(1).max(240),
}).strict();

export const specialistActionSchema = z.object({
  taskId: z.string().uuid(),
  candidateStaffId: z.string().uuid(),
  checklist: z.array(z.string()).min(1).max(12),
  evidenceRequired: z.array(z.string()).min(1).max(8),
  communicationType: z.enum(["assignment", "urgent_alert", "approval_request"]),
}).strict();

export const verificationDecisionSchema = z.object({
  taskId: z.string().uuid(),
  verdict: z.enum(["pass", "fail", "needs_human_review"]),
  missingEvidence: z.array(z.string()).max(8),
  reasons: z.array(z.string()).min(1).max(8),
  suggestedReplanReason: z.string().max(500).nullable(),
}).strict();

export type TriageResult = z.infer<typeof triageResultSchema>;
export type IncidentPlan = z.infer<typeof incidentPlanSchema>;
export type PlanTask = z.infer<typeof planTaskSchema>;
export type SpecialistAction = z.infer<typeof specialistActionSchema>;
export type VerificationDecision = z.infer<typeof verificationDecisionSchema>;

export interface AgentInput<TContext> {
  runId: string;
  institutionId: string;
  incidentId: string;
  incidentVersion: number;
  promptVersion: string;
  context: TContext;
}

export interface AgentOutput<TResult> {
  agent: AgentName;
  result: TResult;
  provider: "featherless";
  model: string;
  latencyMs: number;
  repaired: boolean;
}

export interface AgentModule<TContext, TResult> {
  readonly name: AgentName;
  execute(input: AgentInput<TContext>): Promise<AgentOutput<TResult>>;
}
