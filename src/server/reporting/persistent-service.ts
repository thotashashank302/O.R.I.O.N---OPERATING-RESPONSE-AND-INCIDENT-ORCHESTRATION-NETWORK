import { z } from "zod";
import { throwPersistenceError, WorkflowPersistenceError } from "./persistence-errors";
import { randomUUID } from "node:crypto";
import type { AuthorizedContext, IncidentState } from "@/contracts/domain";
import type { Json } from "@/contracts/database";
import { PersistentCreateIncidentSchema, type CreateIncidentInput } from "@/contracts/reporting";
import { runTriageAgent } from "@/server/agents/triage";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";


interface IncidentRow {
  id: string;
  institution_id: string;
  reporter_membership_id: string;
  accused_membership_id: string | null;
  reporting_scope: { kind?: string } | null;
  category: string;
  visibility: "routine" | "restricted" | "confidential";
  location_id: string | null;
  location_text: string | null;
  description: string;
  severity: "low" | "normal" | "high" | "critical";
  state: IncidentState;
  version: number;
  triage_summary: string | null;
  replan_job?: { id: string } | null;
  clarification_request: { question: string; missingFields: string[] } | null;
  vote_count?: number;
  has_voted?: boolean;
  created_at: string;
  updated_at: string;
}

function project(row: IncidentRow, voteCount = 0, hasVoted = false) {
  return {
    id: row.id,
    institutionId: row.institution_id,
    reporterId: row.reporter_membership_id,
    reportingScope: row.reporting_scope?.kind ?? "student",
    category: row.category,
    description: row.description,
    locationId: row.location_id,
    locationText: row.location_text ?? "Location not specified",
    visibility: row.visibility,
    isConfidential: row.visibility === "confidential",
    severity: row.severity,
    state: row.state,
    version: row.version,
    voteCount,
    hasVoted,
    triageSummary: row.triage_summary,
    clarificationRequest: row.clarification_request,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function voteFacts(incidentId: string, membershipId: string) {
  const db = createSupabaseAdmin();
  const [{ count, error: countError }, { data, error: voteError }] = await Promise.all([
    db.from("incident_votes").select("incident_id", { count: "exact", head: true }).eq("incident_id", incidentId),
    db.from("incident_votes").select("incident_id").eq("incident_id", incidentId).eq("membership_id", membershipId).maybeSingle(),
  ]);
  if (countError || voteError) throwReadUnavailable();
  return { voteCount: count ?? 0, hasVoted: Boolean(data) };
}

function throwReadUnavailable(): never {
  throw new WorkflowPersistenceError("READ_UNAVAILABLE", "Incident data is temporarily unavailable. Please retry.", 503);
}

export async function createPersistentIncident(context: AuthorizedContext, input: CreateIncidentInput) {
  const validated = PersistentCreateIncidentSchema.parse({ ...input, institutionId: context.institutionId });
  const db = createSupabaseAdmin();
  const { data: locations, error: locationsError } = await db.from("campus_locations")
    .select("id,label,kind").eq("institution_id", context.institutionId).limit(200);
  if (locationsError) throw locationsError;
  const incidentId = randomUUID();
  const { result: triage, log } = await runTriageAgent({
    incidentId,
    institutionId: context.institutionId,
    description: validated.description,
    locationText: validated.locationText,
    locationId: validated.locationId,
    categorySuggestion: validated.categorySuggestion,
    hasPhotos: validated.attachments.length > 0,
    knownLocations: locations ?? [],
  });
  const severity = triage.secondaryRisks.length > 1 ? "critical" : triage.secondaryRisks.length > 0 ? "high" : "normal";
  const now = new Date().toISOString();
  const row: IncidentRow = {
    id: incidentId,
    institution_id: context.institutionId,
    reporter_membership_id: context.membershipId,
    accused_membership_id: validated.accusedMembershipId ?? null,
    reporting_scope: { kind: validated.reportingScope, ...(validated.scopeContext ?? {}) },
    category: triage.category,
    visibility: validated.isConfidential ? "confidential" : "routine",
    location_id: triage.locationId ?? validated.locationId ?? null,
    location_text: validated.locationText,
    description: validated.description,
    severity,
    state: triage.clarification?.needed ? "needs_clarification" : "triaging",
    version: 1,
    triage_summary: triage.impactSummary,
    clarification_request: triage.clarification ? { question: triage.clarification.question, missingFields: triage.clarification.missingFields } : null,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await db.rpc("orion_create_incident", {
    tenant_id: context.institutionId, actor_id: context.membershipId,
    operation_id: validated.operationId, request_payload: validated as unknown as Json,
    incident_payload: row as unknown as Json,
    agent_payload: {
      id: randomUUID(), provider: log.provider, model: log.model, prompt_version: log.promptVersion,
      latency_ms: log.latencyMs, status: log.status === "failed" ? "failed" : "succeeded",
      validated_outcome: triage, safe_error: log.error ?? null,
    } as unknown as Json,
  });
  if (error) throwPersistenceError(error);
  const result = data as unknown as { incident: IncidentRow; job: { id: string } | null; rateLimitRemaining: number };
  return { ...result, incident: project(result.incident) };
}

export async function listPersistentIncidents(context: AuthorizedContext, cursor?: string | null) {
  const parts = cursor?.split("|");
  if (parts && (parts.length !== 2 || !z.string().datetime({ offset: true }).safeParse(parts[0]).success || !z.string().uuid().safeParse(parts[1]).success)) {
    throw new WorkflowPersistenceError("INVALID_CURSOR", "Invalid incident page cursor", 400);
  }
  const { data, error } = await createSupabaseAdmin().rpc("orion_incident_feed", {
    actor_id: context.membershipId, tenant_id: context.institutionId,
    before_time: parts?.[0], before_id: parts?.[1], page_size: 50,
  });
  if (error) throwReadUnavailable();
  return (data as unknown as IncidentRow[] ?? []).map(row => project(row, row.vote_count ?? 0, row.has_voted ?? false));
}

export async function getPersistentIncident(context: AuthorizedContext, incidentId: string) {
  const { data, error } = await createSupabaseAdmin().rpc("orion_get_incident", {
    actor_id: context.membershipId, tenant_id: context.institutionId, target_id: incidentId,
  });
  if (error) throwReadUnavailable();
  if (!data) return null;
  const row = data as unknown as IncidentRow;
  return project(row, row.vote_count ?? 0, row.has_voted ?? false);
}

export async function setPersistentVote(context: AuthorizedContext, incidentId: string, voted: boolean) {
  const incident = await getPersistentIncident(context, incidentId);
  if (!incident) throw new Error("Incident not found");
  if (incident.isConfidential) throw new Error("Voting is strictly excluded for confidential incidents");
  const db = createSupabaseAdmin();
  const query = voted
    ? db.from("incident_votes").upsert({ incident_id: incidentId, institution_id: context.institutionId, membership_id: context.membershipId })
    : db.from("incident_votes").delete().eq("incident_id", incidentId).eq("membership_id", context.membershipId);
  const { error } = await query;
  if (error) throw error;
  return { ...(await voteFacts(incidentId, context.membershipId)) };
}

export async function clarifyPersistentIncident(context: AuthorizedContext, incidentId: string, answer: string, expectedVersion: number) {
  const current = await getPersistentIncident(context, incidentId);
  if (!current || current.reporterId !== context.membershipId) throw new Error("Unauthorized: only the reporter can clarify this incident");
  if (current.version !== expectedVersion) throw new Error("Version mismatch");
  if (current.state !== "needs_clarification") throw new Error("Incident is not awaiting clarification");
  const { data, error } = await createSupabaseAdmin().rpc("orion_clarify_incident", {
    target_id: incidentId, actor_id: context.membershipId, expected_version: expectedVersion, answer,
  });
  if (error) throwPersistenceError(error);
  const result = data as unknown as { incident: IncidentRow; job: { id: string } };
  return { incident: project(result.incident), job: result.job };
}

export async function confirmPersistentIncident(
  context: AuthorizedContext,
  incidentId: string,
  decision: "accepted" | "rejected",
  reason: string,
  expectedVersion: number,
) {
  const current = await getPersistentIncident(context, incidentId);
  if (!current || current.reporterId !== context.membershipId) throw new Error("Unauthorized: only the reporter can confirm resolution");
  if (current.version !== expectedVersion) throw new Error("Version mismatch");
  if (current.state !== "submitted_for_verification") throw new Error("Invalid incident state for reporter confirmation");
  if (decision === "rejected" && (!reason || reason.trim().length < 3)) throw new Error("A rejection reason is required");

  const db = createSupabaseAdmin();

  const { data, error } = await db.rpc("orion_confirm_incident", {
    target_id: incidentId, actor_id: context.membershipId, expected_version: expectedVersion, decision, reason,
  });
  if (error) throwPersistenceError(error);
  const row = data as unknown as IncidentRow;
  // The RPC records the decision and its durable replan request together.
  return { incident: project(row), verification: { decision, reason }, job: row.replan_job ?? null };
}
