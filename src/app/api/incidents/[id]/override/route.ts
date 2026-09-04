import { activeMembership } from "@/server/auth/active-membership";
/**
 * POST /api/incidents/[id]/override
 * Developer 4 (Anjali) owns this endpoint, with D1 policy enforcement.
 *
 * HOD authorized override: reassign staff or correct priority.
 * Requires HOD scope check, reason, and expected_version.
 * All overrides create an audit trail.
 * Do not offer AI autonomous access here.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/server/db/client";
import { randomUUID } from "crypto";

const OverrideSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(1000),
  new_assignee_membership_id: z.string().uuid().optional(),
  new_priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  expected_version: z.number().int().nonnegative(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: incidentId } = await params;

  try {
    const session = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await session.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId },
        { status: 401 }
      );
    }

    // Resolve active membership
    const { data: membership, error: memberError } = await activeMembership(session, user.id);

    if (memberError || !membership) {
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_MEMBERSHIP", message: "No active membership" }, requestId },
        { status: 403 }
      );
    }

    const supabase = await createServiceClient();

    // Verify HOD role for this institution
    const { data: hodGrant } = await supabase
      .from("role_grants")
      .select("id, department_id")
      .eq("membership_id", membership.id)
      .eq("role", "hod")
      .is("revoked_at", null)
      .maybeSingle();

    if (!hodGrant) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Only a HOD can perform overrides",
          },
          requestId,
        },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = OverrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid override data",
            details: parsed.error.flatten(),
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // At least one override field required
    if (!parsed.data.new_assignee_membership_id && !parsed.data.new_priority) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "At least one of new_assignee_membership_id or new_priority must be provided",
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // Fetch current incident
    const { data: incident, error: incidentError } = await supabase
      .from("incidents")
      .select("id, institution_id, version, severity, state")
      .eq("id", incidentId)
      .eq("institution_id", membership.institution_id)
      .single();

    if (incidentError || !incident) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Incident not found" }, requestId },
        { status: 404 }
      );
    }

    // Version check
    if (incident.version !== parsed.data.expected_version) {
      return NextResponse.json(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "Incident version mismatch — reload and try again",
          },
          requestId,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Apply priority override if requested
    if (parsed.data.new_priority) {
      await supabase
        .from("incidents")
        .update({
          severity: parsed.data.new_priority,
          version: incident.version + 1,
          updated_at: now,
        })
        .eq("id", incidentId);
    }

    // Apply assignee override if requested — reassign active assignment
    if (parsed.data.new_assignee_membership_id) {
      const { data: activePlan } = await supabase.from("incident_plans")
        .select("id").eq("incident_id", incidentId).eq("status", "active").maybeSingle();
      const { data: planTasks } = activePlan
        ? await supabase.from("incident_tasks").select("id").eq("plan_id", activePlan.id)
        : { data: [] };
      const taskIds = (planTasks ?? []).map((task) => task.id);
      const { data: activeAssignment } = await supabase.from("assignments")
        .select("id, task_id, version, active_version")
        .in("task_id", taskIds.length > 0 ? taskIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("active_version", true)
        .in("state", ["offered", "acknowledged", "active"])
        .limit(1)
        .maybeSingle();

      if (activeAssignment) {
        // Cancel old assignment
        await supabase
          .from("assignments")
          .update({ state: "cancelled", active_version: false, updated_at: now })
          .eq("id", activeAssignment.id);

        // Create new assignment for override target
        await supabase.from("assignments").insert({
          id: randomUUID(),
          institution_id: membership.institution_id,
          task_id: activeAssignment.task_id,
          assignee_membership_id: parsed.data.new_assignee_membership_id,
          state: "offered",
          version: activeAssignment.version + 1,
          active_version: true,
          acknowledgement_deadline: new Date(
            Date.now() + 10 * 60 * 1000
          ).toISOString(), // 10-min ack deadline
          created_at: now,
          updated_at: now,
        });
      }
    }

    // Audit event
    await supabase.from("audit_events").insert({
      institution_id: membership.institution_id,
      actor_membership_id: membership.id,
      action: "hod_override",
      target_type: "incident",
      target_id: incidentId,
      safe_payload: {
        previous: { severity: incident.severity, version: incident.version },
        next: { severity: parsed.data.new_priority ?? incident.severity, new_assignee: parsed.data.new_assignee_membership_id ?? null },
        reason: parsed.data.reason,
      },
      created_at: now,
    });

    // Incident event
    await supabase.from("incident_events").insert({
      institution_id: membership.institution_id,
      incident_id: incidentId,
      actor_membership_id: membership.id,
      actor_type: "human",
      action: "hod_override",
      safe_payload: {
        reason: parsed.data.reason,
        new_priority: parsed.data.new_priority ?? null,
        new_assignee: parsed.data.new_assignee_membership_id ?? null,
      },
      created_at: now,
    });

    return NextResponse.json(
      {
        data: {
          incident_id: incidentId,
          applied_at: now,
          new_priority: parsed.data.new_priority ?? null,
          new_assignee: parsed.data.new_assignee_membership_id ?? null,
        },
        requestId,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(
      `[POST /api/incidents/${incidentId}/override] requestId=${requestId}`,
      message
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
