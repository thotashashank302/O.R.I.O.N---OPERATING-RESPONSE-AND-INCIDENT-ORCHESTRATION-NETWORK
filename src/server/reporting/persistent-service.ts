import { randomUUID } from "node:crypto";
import type { AuthorizedContext, IncidentState } from "@/contracts/domain";
import type { Json, TablesInsert } from "@/contracts/database";
import { CreateIncidentSchema, type CreateIncidentInput } from "@/contracts/reporting";
import { runTriageAgent } from "@/server/agents/triage";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { enqueueCommanderJob } from "@/server/orchestration/commander-enqueue";

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
  clarification_request: { question: string; missingFields: string[] } | null;
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

function canRead(row: IncidentRow, context: AuthorizedContext): boolean {
  if (row.institution_id !== context.institutionId) return false;
  if (row.accused_membership_id === context.membershipId) return false;
  if (row.visibility !== "confidential") return true;
  return row.reporter_membership_id === context.membershipId
    || context.roles.some((role) => ["principal", "admin", "safeguarding_officer"].includes(role));
}

async function voteFacts(incidentId: string, membershipId: string) {
  const db = createSupabaseAdmin();
  const [{ count }, { data }] = await Promise.all([
    db.from("incident_votes").select("incident_id", { count: "exact", head: true }).eq("incident_id", incidentId),
    db.from("incident_votes").select("incident_id").eq("incident_id", incidentId).eq("membership_id", membershipId).maybeSingle(),
  ]);
  return { voteCount: count ?? 0, hasVoted: Boolean(data) };
}

export async function createPersistentIncident(context: AuthorizedContext, input: CreateIncidentInput) {
  const validated = CreateIncidentSchema.parse({ ...input, institutionId: context.institutionId });
  const db = createSupabaseAdmin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from("incidents").select("id", { count: "exact", head: true })
    .eq("reporter_membership_id", context.membershipId).gte("created_at", since);
  if (!validated.isConfidential && (count ?? 0) >= 5) throw new Error("Rate limit exceeded: Maximum 5 normal reports per hour allowed.");

  const { data: locations } = await db.from("campus_locations")
    .select("id,label,kind").eq("institution_id", context.institutionId).limit(200);
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
  const { error } = await db.from("incidents").insert(row as unknown as TablesInsert<"incidents">);
  if (error) throw error;
  if (validated.attachments.length > 0) {
    const { error: attachmentError } = await db.from("incident_attachments").insert(validated.attachments.map((item) => ({
      institution_id: context.institutionId,
      incident_id: incidentId,
      uploader_membership_id: context.membershipId,
      storage_key: item.storageKey,
      file_name: item.fileName,
      file_size: item.fileSize,
      mime_type: item.mimeType,
    })));
    if (attachmentError) throw attachmentError;
  }
  await db.from("agent_runs").insert({
    id: randomUUID(), institution_id: context.institutionId, incident_id: incidentId, agent_name: "triage",
    provider: log.provider, model: log.model, prompt_version: log.promptVersion, latency_ms: log.latencyMs,
    status: log.status === "failed" ? "failed" : "succeeded", validated_outcome: triage as unknown as Json, safe_error: log.error ?? null,
  });
  await db.from("incident_events").insert({
    institution_id: context.institutionId, incident_id: incidentId, actor_membership_id: context.membershipId,
    actor_type: "human", action: "incident_reported", safe_payload: { category: row.category, state: row.state },
  });
  const job = row.state === "triaging" ? await enqueueCommanderJob(row.id) : null;
  return { incident: project(row), job, rateLimitRemaining: Math.max(0, 4 - (count ?? 0)) };
}

export async function listPersistentIncidents(context: AuthorizedContext) {
  const db = createSupabaseAdmin();
  const { data, error } = await db.from("incidents").select("*")
    .eq("institution_id", context.institutionId).order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const readable = (data as IncidentRow[]).filter((row) => canRead(row, context));
  return Promise.all(readable.map(async (row) => {
    const facts = await voteFacts(row.id, context.membershipId);
    return project(row, facts.voteCount, facts.hasVoted);
  }));
}

export async function getPersistentIncident(context: AuthorizedContext, incidentId: string) {
  const { data, error } = await createSupabaseAdmin().from("incidents").select("*").eq("id", incidentId).maybeSingle();
  if (error || !data || !canRead(data as IncidentRow, context)) return null;
  const facts = await voteFacts(incidentId, context.membershipId);
  return project(data as IncidentRow, facts.voteCount, facts.hasVoted);
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
  const db = createSupabaseAdmin();
  const nextVersion = expectedVersion + 1;
  const { data, error } = await db.from("incidents").update({
    description: `${current.description}\nReporter clarification: ${answer}`,
    clarification_request: null,
    state: "triaging",
    version: nextVersion,
    updated_at: new Date().toISOString(),
  }).eq("id", incidentId).eq("version", expectedVersion).select("*").single();
  if (error) throw error;
  const job = await enqueueCommanderJob(incidentId);
  return { incident: project(data as IncidentRow), job };
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
  const { data, error } = await createSupabaseAdmin().rpc("orion_confirm_incident", {
    target_id: incidentId, actor_id: context.membershipId, expected_version: expectedVersion, decision, reason,
  });
  if (error) throw new Error(error.message);
  const row = data as unknown as IncidentRow;
  const job = decision === "rejected"
    ? await enqueueCommanderJob(incidentId, reason, `reporter-rejected-${row.version}`)
    : null;
  return { incident: project(row), verification: { decision, reason }, job };
}
