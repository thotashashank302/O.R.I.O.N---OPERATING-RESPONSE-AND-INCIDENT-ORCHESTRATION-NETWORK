import { activeMembership } from "@/server/auth/active-membership";
/**
 * ORION — Staff Dashboard
 * Developer 4 (Anjali) owns this file.
 *
 * Shows only the authenticated staff member's authorized assignments.
 * Displays task queue, availability control, and evidence submission.
 * No cross-department or private case details exposed.
 */

import { StaffEvidence } from "@/features/resolution/StaffEvidence";
import { QueueRefresh } from "@/features/operations/QueueRefresh";
import { redirect } from "next/navigation";
import { createClient } from "@/server/db/client";
import { getStaffAssignments } from "@/server/operations/assignments";
import { getAvailability } from "@/server/operations/availability";
import { AvailabilityControl } from "@/features/staff-availability/AvailabilityControl";
import { AssignmentActionButton } from "@/features/operations/AssignmentActionButton";
import type { Assignment } from "@/contracts/operations";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-300",
  high: "bg-amber-50 text-amber-700 border-amber-300",
  normal: "bg-blue-50 text-blue-700 border-blue-300",
  low: "bg-stone-50 text-stone-600 border-stone-300",
};

const STATE_BADGE: Record<string, string> = {
  offered: "bg-purple-50 text-purple-700",
  acknowledged: "bg-blue-50 text-blue-700",
  active: "bg-emerald-50 text-emerald-700",
  handover_requested: "bg-amber-50 text-amber-700",
  completed: "bg-stone-50 text-stone-600",
};

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const incident = assignment.incident;
  const task = assignment.task;
  const isOverdue =
    assignment.state === "offered" && assignment.acknowledgement_deadline &&
    new Date(assignment.acknowledgement_deadline) < new Date();

  return (
    <div
      className={`rounded-2xl border bg-white/80 p-5 transition-all hover:border-stone-400 ${
        isOverdue ? "border-red-300" : "border-stone-200"
      }`}
    >
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {incident?.severity && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                SEVERITY_BADGE[incident.severity] ?? ""
              }`}
            >
              {incident.severity}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
              STATE_BADGE[assignment.state] ?? "bg-slate-600 text-slate-300"
            }`}
          >
            {assignment.state.replace(/_/g, " ")}
          </span>
          {isOverdue && (
            <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-400">
              ⏰ Overdue
            </span>
          )}
        </div>
        <span className="font-mono text-xs text-stone-400">
          v{assignment.version}
        </span>
      </div>

      {/* Incident title */}
      <h3 className="mb-1 font-semibold leading-snug">
        {incident?.title ?? "Task Assignment"}
      </h3>

      {/* Category + location */}
      {incident && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          <span>{incident.category}</span>
          <span>📍 {incident.location_label}</span>
        </div>
      )}

      {/* Checklist preview */}
      {task?.checklist && task.checklist.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Checklist
          </p>
          <ul className="space-y-1">
            {task.checklist.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-stone-600">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500/60" />
                {item}
              </li>
            ))}
            {task.checklist.length > 3 && (
              <li className="text-xs text-stone-400">
                +{task.checklist.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Ack deadline */}
      {assignment.acknowledgement_deadline && (
        <p className={`text-xs ${isOverdue ? "text-red-600" : "text-stone-500"}`}>
          Acknowledge by:{" "}
          {new Date(assignment.acknowledgement_deadline).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      )}

      {assignment.state === "active" && task && <StaffEvidence assignment={assignment} />}
      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {assignment.state === "offered" && (
          <AssignmentActionButton
            assignmentId={assignment.id}
            action="acknowledge"
            version={assignment.version}
            label="Acknowledge"
            color="cyan"
          />
        )}
        {assignment.state === "acknowledged" && (
          <AssignmentActionButton
            assignmentId={assignment.id}
            action="start"
            version={assignment.version}
            label="Start Work"
            color="emerald"
          />
        )}
        {assignment.state === "active" && (
          <>
            <AssignmentActionButton
              assignmentId={assignment.id}
              action="handover"
              version={assignment.version}
              label="Request Handover"
              color="amber"
            />
          </>
        )}
      </div>
    </div>
  );
}

export default async function StaffPage() {
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

  // Fetch assignments and availability in parallel
  const [assignments, availabilityData] = await Promise.all([
    getStaffAssignments(membership.id, membership.institution_id),
    getAvailability(membership.id).catch(() => null),
  ]);

  const activeCount = assignments.filter(
    (a) => a.state === "active" || a.state === "acknowledged"
  ).length;
  const offeredCount = assignments.filter((a) => a.state === "offered").length;

  return (
    <div className="px-4 py-8 sm:px-8">
      <QueueRefresh />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">My Work Queue</h1>
        <p className="mt-1 text-sm text-stone-500">
          Showing your authorized assignments only
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: availability + stats */}
        <div id="availability" className="scroll-mt-6 space-y-4 lg:col-span-1">
          {/* Availability control */}
          {availabilityData ? (
            <AvailabilityControl
              initialState={availabilityData.state}
              initialVersion={availabilityData.version}
              membershipId={membership.id}
            />
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-5">
              <p className="text-sm text-stone-500">
                No availability record found. Contact supervisor.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white/80 p-4 text-center">
              <p className="text-2xl font-bold text-cyan-600">{activeCount}</p>
              <p className="mt-0.5 text-xs text-stone-500">Active</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white/80 p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{offeredCount}</p>
              <p className="mt-0.5 text-xs text-stone-500">Pending Ack</p>
            </div>
          </div>
        </div>

        {/* Right column: assignments */}
        <div id="evidence" className="scroll-mt-6 space-y-4 lg:col-span-2">
          {assignments.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-stone-300 text-sm text-stone-500">
              No active assignments. Check back soon.
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
