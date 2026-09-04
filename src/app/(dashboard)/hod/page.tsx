import { activeMembership } from "@/server/auth/active-membership";
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
  incident_id: string;
  incident: { severity: string } | null;
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
  critical: "text-red-700 border-red-300 bg-red-50",
  high: "text-amber-700 border-amber-300 bg-amber-50",
  normal: "text-blue-700 border-blue-300 bg-blue-50",
  low: "text-stone-600 border-stone-300 bg-stone-50",
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
  const { data: membership } = await activeMembership(supabase, user.id);

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
      incident_id,
      incident:incidents(severity)
    `
    )
    .eq("institution_id", membership.institution_id)
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
    action_description: "Pending orchestrated action requiring HOD approval",
    requested_by_name: "ORION orchestration",
    incident_id: a.incident_id,
    is_high_risk: a.incident?.severity === "critical" || a.incident?.severity === "high",
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
    <div className="px-4 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">HOD Operations</h1>
        <p className="mt-1 text-sm text-stone-500">
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
        <section id="approvals" className="scroll-mt-6">
          <h2 className="mb-4 text-lg font-semibold">
            Pending Approvals
          </h2>

          {pendingApprovals.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-500">
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
        <section id="incidents" className="scroll-mt-6">
          <h2 className="mb-4 text-lg font-semibold">
            Incident Queue
          </h2>

          {incidentQueue.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-500">
              No open incidents
            </div>
          ) : (
            <div className="space-y-3">
              {incidentQueue.map((incident) => (
                <div
                  key={incident.id}
                  className={`rounded-xl border bg-white/80 p-4 transition-all hover:border-stone-400 ${
                    incident.is_overdue
                      ? "border-red-300"
                      : "border-stone-200"
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
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 capitalize">
                        {incident.state.replace(/_/g, " ")}
                      </span>
                      {incident.is_overdue && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                          Escalate
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-stone-400">
                      v{incident.version}
                    </span>
                  </div>

                  <p className="text-sm font-medium capitalize">
                    {incident.category.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-stone-500">📍 {incident.location}</p>
                  <p className="mt-1 text-xs text-stone-400">
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
    cyan: "text-cyan-600",
    red: "text-red-600",
    amber: "text-amber-600",
    purple: "text-purple-600",
  };
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-4 text-center">
      <p className={`text-3xl font-bold ${colorMap[color]}`}>{value}</p>
      <p className="mt-1 text-xs text-stone-500">{label}</p>
    </div>
  );
}
