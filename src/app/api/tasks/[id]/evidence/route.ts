/**
 * POST /api/tasks/[id]/evidence
 * Developer 4 (Anjali) owns this endpoint.
 *
 * Collects repair notes, functional test results, and optional photo references.
 * Staff submit FOR VERIFICATION — there is no unrestricted Resolve button.
 * Internal issues require functional test information.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/server/db/client";
import { randomUUID } from "crypto";

const EvidenceSchema = z.object({
  kind: z.enum(["note", "test_result", "photo"]),
  content: z.string().min(10, "Evidence content must be at least 10 characters").max(2000),
  storage_key: z.string().optional(), // for photo_ref — from D3's upload service
  expected_assignment_version: z.number().int().nonnegative(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: taskId } = await params;

  try {
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId },
        { status: 401 }
      );
    }

    // Resolve active membership
    const { data: membership, error: memberError } = await supabase
      .from("institution_memberships")
      .select("id, institution_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_MEMBERSHIP", message: "No active membership" }, requestId },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = EvidenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid evidence data",
            details: parsed.error.flatten(),
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // Verify the staff member has an active assignment for this task
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
    .select("id, institution_id, assignee_membership_id, state, version, active_version")
      .eq("task_id", taskId)
      .eq("assignee_membership_id", membership.id)
      .in("state", ["active", "acknowledged"])
      .single();

    if (assignError || !assignment) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "You do not have an active assignment for this task",
          },
          requestId,
        },
        { status: 403 }
      );
    }

    const { data: task } = await supabase
      .from("incident_tasks")
      .select("plan_id")
      .eq("id", taskId)
      .eq("institution_id", membership.institution_id)
      .maybeSingle();
    const { data: plan } = task
      ? await supabase.from("incident_plans").select("incident_id").eq("id", task.plan_id).maybeSingle()
      : { data: null };
    if (!plan?.incident_id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task incident context not found" }, requestId },
        { status: 404 }
      );
    }

    // Version check
    if (!assignment.active_version || assignment.version !== parsed.data.expected_assignment_version) {
      return NextResponse.json(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "Assignment version mismatch — reload and retry",
          },
          requestId,
        },
        { status: 409 }
      );
    }

    // Photo evidence must reference a private storage object.
    if (parsed.data.kind === "photo" && !parsed.data.storage_key?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "storage_key is required for photo evidence",
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // Get current evidence version for this task
    const { data: existing } = await supabase
      .from("resolution_evidence")
      .select("evidence_version")
      .eq("task_id", taskId)
      .order("evidence_version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = ((existing as { evidence_version: number } | null)?.evidence_version ?? 0) + 1;

    // Insert evidence record
    const { data: evidence, error: insertError } = await supabase
      .from("resolution_evidence")
      .insert({
        id: randomUUID(),
        institution_id: assignment.institution_id,
        task_id: taskId,
        uploader_membership_id: membership.id,
        kind: parsed.data.kind,
        storage_key: parsed.data.kind === "photo" ? parsed.data.storage_key! : null,
        structured_result: parsed.data.kind === "photo"
          ? { note: parsed.data.content }
          : { content: parsed.data.content },
        evidence_version: nextVersion,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !evidence) {
      throw new Error(`Failed to save evidence: ${insertError?.message}`);
    }

    // Append incident event
    await supabase.from("incident_events").insert({
      institution_id: membership.institution_id,
      incident_id: plan.incident_id,
      actor_membership_id: membership.id,
      actor_type: "human",
      action: "evidence_submitted",
      safe_payload: {
        task_id: taskId,
        kind: parsed.data.kind,
        evidence_version: nextVersion,
        assignment_id: assignment.id,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ data: evidence, requestId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[POST /api/tasks/${taskId}/evidence] requestId=${requestId}`, message);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
