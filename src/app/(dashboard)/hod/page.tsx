/**
 * ORION — HOD Dashboard
 * Developer 4 (Anjali) owns this file.
 *
 * Shows:
 * - Scoped assignment queue for the HOD's department
 * - Pending approvals with deadline/escalation view
 * - HOD override controls
 * - Verification status of active incidents
 *
 * HOD scope: limited to their department — cannot act on other departments' incidents.
 * High-risk physical/security actions remain human-controlled (no AI autonomous access).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/server/db/client";
import { HODApprovalPanel } from "@/features/operations/HODApprovalPanel";

interface PendingApproval {
  id: string;
  action_payload_hash: string;
  plan_version: number;
  action_description: string;
  requested_by_name: string;
  incident_id: string;
  is_high_risk: boolean;
  created_at: string;
}

interface IncidentQueueItem {
  id: string;
  category: string;
  severity: string;
  state: string;
  location: string;
  version: number;
  created_at: string;
  deadline: string | null;
  is_overdue: boolean;
  is_escalated: boolean;
}

interface RawApprovalRow {
  id: string;
  action_payload_hash: string;
  plan_version: number;
  action_description: string | null;
  profiles: { display_name: string | null } | null;
  incident_id: string;
  is_high_risk: boolean | null;
  created_at: string;
}

interface RawIncidentRow {
  id: string;
  category: string;
  severity: string;
  state: string;
  version: number;
  created_at: string;
  campus_locations: { label: string | null } | null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/10",
  high: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  normal: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  low: "text-slate-400 border-slate-500/30 bg-slate-500/10",
};

export default async function HODPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Resolve active membership
  const { data: membership } = await supabase
    .from("institution_memberships")
    .select("id, institution_id, state")
    .eq("user_id", user.id)
    .eq("state", "active")
    .maybeSingle();

  if (!membership) {
    redirect("/login");
  }

  // Verify HOD role
  const { data: hodGrant } = await supabase
    .from("role_grants")
    .select("id, department_id")
    .eq("membership_id", membership.id)
    .eq("role", "hod")
    .is("revoked_at", null)
    .maybeSingle();

  if (!hodGrant) {
    redirect("/dashboard");
  }

  // Fetch pending approvals for HOD's department
  const { data: rawApprovals } = await supabase
    .from("approvals")
    .select(
      `
      id,
      action_payload_hash,
      plan_version,
      created_at,
      requested_by_membership_id,
      profiles!requested_by_membership_id(display_name),
      action_description,
      is_high_risk,
      incident_id
    `
    )
    .is("decision", null)
    .order("created_at", { ascending: true })
    .limit(20);

  // Fetch incident queue for HOD's department
  const { data: rawIncidents } = await supabase
    .from("incidents")
    .select(
      `
      id,
      category,
      severity,
      state,
      version,
      created_at,
      campus_locations ( label ),
      incident_plans ( status, created_at )
    `
    )
    .eq("institution_id", membership.institution_id)
    .not("state", "in", '("resolved","cancelled")')
    .order("created_at", { ascending: false })
    .limit(30);

  const approvalRows = (rawApprovals ?? []) as unknown as RawApprovalRow[];
  const pendingApprovals: PendingApproval[] = approvalRows.map((a) => ({
    id: a.id,
    action_payload_hash: a.action_payload_hash,
    plan_version: a.plan_version,
    action_description: a.action_description ?? "Pending action requiring HOD approval",
    requested_by_name: a.profiles?.display_name ?? "Unknown",
    incident_id: a.incident_id,
    is_high_risk: a.is_high_risk ?? false,
    created_at: a.created_at,
  }));

  const incidentRows = (rawIncidents ?? []) as unknown as RawIncidentRow[];
  const incidentQueue: IncidentQueueItem[] = incidentRows.map((inc) => {
    return {
      id: inc.id,
      category: inc.category,
      severity: inc.severity,
      state: inc.state,
      location: inc.campus_locations?.label ?? "Unknown",
      version: inc.version,
      created_at: inc.created_at,
      deadline: null,
      // The durable worker owns time-based escalation; render its persisted state.
      is_overdue: inc.state === "escalated",
      is_escalated: inc.state === "escalated",
    };
  });

  const criticalCount = incidentQueue.filter(
    (i) => i.severity === "critical"
  ).length;
  const overdueCount = incidentQueue.filter((i) => i.is_overdue).length;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">HOD Operations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Department incident oversight, escalations, and approvals
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open Incidents" value={incidentQueue.length} color="cyan" />
        <StatCard label="Critical" value={criticalCount} color="red" />
        <StatCard label="Overdue" value={overdueCount} color="amber" />
        <StatCard label="Pending Approvals" value={pendingApprovals.length} color="purple" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Pending Approvals */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Pending Approvals
          </h2>

          {pendingApprovals.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-sm text-slate-600">
              No pending approvals
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map((approval) => (
                <HODApprovalPanel
                  key={approval.id}
                  approvalId={approval.id}
                  actionDescription={approval.action_description}
                  actionPayloadHash={approval.action_payload_hash}
                  planVersion={approval.plan_version}
                  requestedByName={approval.requested_by_name}
                  isHighRiskPhysical={approval.is_high_risk}
                />
              ))}
            </div>
          )}
        </section>

        {/* Incident Queue */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Incident Queue
          </h2>

          {incidentQueue.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-sm text-slate-600">
              No open incidents
            </div>
          ) : (
            <div className="space-y-3">
              {incidentQueue.map((incident) => (
                <div
                  key={incident.id}
                  className={`rounded-xl border bg-slate-800/60 p-4 transition-all hover:border-slate-600 ${
                    incident.is_overdue
                      ? "border-red-500/40"
                      : "border-slate-700/50"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
                          SEVERITY_COLOR[incident.severity] ?? ""
                        }`}
                      >
                        {incident.severity}
                      </span>
                      <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400 capitalize">
                        {incident.state.replace(/_/g, " ")}
                      </span>
                      {incident.is_overdue && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                          Escalate
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-600">
                      v{incident.version}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-white capitalize">
                    {incident.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-slate-500">📍 {incident.location}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Opened:{" "}
                    {new Date(incident.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "cyan" | "red" | "amber" | "purple";
}) {
  const colorMap = {
    cyan: "text-cyan-400",
    red: "text-red-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-center">
      <p className={`text-3xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
