import { createClient, createServiceClient } from "@/server/db/client";

/** Read the scoped queue and display names; the decision RPC rechecks authority at write time. */
export async function listApprovalQueue(membership: { id: string; institution_id: string }) {
  const db = await createClient();
  const now = new Date().toISOString();
  const { data: grants, error: grantError } = await db.from("role_grants").select("role,department_id")
    .eq("membership_id", membership.id).is("revoked_at", null).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`);
  if (grantError) throw new Error("Approval access is temporarily unavailable");
  const institutionAuthority = (grants ?? []).some(g => ["principal", "admin"].includes(g.role));
  const departments = (grants ?? []).filter(g => g.role === "hod" && g.department_id).map(g => g.department_id!);
  if (!institutionAuthority && !departments.length) return [];
  let query = db.from("approvals").select("id,action_payload,action_payload_hash,plan_version,created_at,incident:incidents!inner(id,reporter_membership_id,accused_membership_id,reporting_scope,severity),incident_tasks!inner(incident_plans!inner(status))")
    .eq("institution_id", membership.institution_id).is("decision", null)
    .eq("incident_tasks.incident_plans.status", "active").order("created_at").limit(100);
  if (!institutionAuthority) query = query.in("incident.reporting_scope->>departmentId", departments);
  const { data: approvals, error } = await query;
  if (error) throw new Error("Approvals are temporarily unavailable");
  const actionable = (approvals ?? []).filter(a => {
    const payload = a.action_payload as { candidateStaffId?: string } | null;
    return a.incident.reporter_membership_id !== membership.id && a.incident.accused_membership_id !== membership.id && payload?.candidateStaffId !== membership.id;
  });
  const ids = [...new Set(actionable.map(a => (a.action_payload as { candidateStaffId?: string } | null)?.candidateStaffId).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const admin = await createServiceClient();
    const members = await admin.from("institution_memberships").select("id,user_id").eq("institution_id", membership.institution_id).in("id", ids);
    if (members.error) throw new Error("Staff names are temporarily unavailable");
    const userIds = (members.data ?? []).map(m => m.user_id);
    if (userIds.length) {
      const profiles = await admin.from("profiles").select("id,display_name").in("id", userIds);
      if (profiles.error) throw new Error("Staff names are temporarily unavailable");
      for (const member of members.data ?? []) names.set(member.id, profiles.data?.find(p => p.id === member.user_id)?.display_name ?? "Staff member");
    }
  }
  return actionable.map(a => {
    const payload = a.action_payload as { candidateStaffId?: string; checklist?: string[]; evidenceRequired?: string[] } | null;
    return { id: a.id, actionPayloadHash: a.action_payload_hash, planVersion: a.plan_version,
      staffName: names.get(payload?.candidateStaffId ?? "") ?? "Staff member", incidentId: a.incident.id,
      description: `Steps: ${payload?.checklist?.join("; ") ?? "Unavailable"}. Evidence: ${payload?.evidenceRequired?.join(", ") ?? "Unavailable"}.`, createdAt: a.created_at };
  });
}
