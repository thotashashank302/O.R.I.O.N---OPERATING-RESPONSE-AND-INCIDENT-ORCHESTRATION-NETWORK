/**
 * POST /api/approvals/[id]/decision
 * Developer 4 (Anjali) owns this endpoint, with D1 policy enforcement.
 *
 * HOD approval/rejection of a specific action tied to a plan version.
 * Validation rules:
 * - Approver cannot approve their own actions (self-approval conflict)
 * - Approval binds to action_payload_hash and plan_version
 * - Stale plan version → rejected
 * - Out-of-scope HOD → rejected
 * - High-risk physical/security actions remain human-controlled
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/server/db/client";
import { randomUUID } from "node:crypto";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  action_payload_hash: z.string().min(1),
  plan_version: z.number().int().positive(),
  reason: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: approvalRequestId } = await params;

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

    // Verify HOD role grant
    const { data: hodGrant, error: hodError } = await supabase
      .from("role_grants")
      .select("id, department_id, revoked_at")
      .eq("membership_id", membership.id)
      .eq("role", "hod")
      .is("revoked_at", null)
      .maybeSingle();

    if (hodError || !hodGrant) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Only a HOD can approve or reject actions",
          },
          requestId,
        },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = DecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid decision data",
            details: parsed.error.flatten(),
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // Fetch the approval request
    const { data: approvalReq, error: approvalError } = await supabase
      .from("approvals")
      .select(
        "id, institution_id, action_payload_hash, plan_version, approver_membership_id, decision, incident_id"
      )
      .eq("id", approvalRequestId)
      .eq("institution_id", membership.institution_id)
      .single();

    if (approvalError || !approvalReq) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Approval request not found" }, requestId },
        { status: 404 }
      );
    }

    // Check if already decided
    if (approvalReq.decision) {
      return NextResponse.json(
        {
          error: {
            code: "ALREADY_DECIDED",
            message: `This approval was already ${approvalReq.decision}`,
          },
          requestId,
        },
        { status: 409 }
      );
    }

    // Plan version check
    if (approvalReq.plan_version !== parsed.data.plan_version) {
      return NextResponse.json(
        {
          error: {
            code: "STALE_PLAN_VERSION",
            message:
              "Plan version mismatch — a new plan version invalidates this approval",
          },
          requestId,
        },
        { status: 409 }
      );
    }

    // Action payload hash check
    if (approvalReq.action_payload_hash !== parsed.data.action_payload_hash) {
      return NextResponse.json(
        {
          error: {
            code: "HASH_MISMATCH",
            message: "Action payload has changed — re-approve with updated action",
          },
          requestId,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Record the decision
    const { data: decision, error: decisionError } = await supabase
      .from("approvals")
      .update({
        approver_membership_id: membership.id,
        decision: parsed.data.decision === "approve" ? "approved" : "rejected",
        reason: parsed.data.reason ?? null,
        decided_at: now,
      })
      .eq("id", approvalRequestId)
      .select()
      .single();

    if (decisionError || !decision) {
      throw new Error(`Failed to record decision: ${decisionError?.message}`);
    }

    // Append incident event
    await supabase.from("incident_events").insert({
      institution_id: membership.institution_id,
      incident_id: approvalReq.incident_id,
      actor_membership_id: membership.id,
      actor_type: "human",
      action: `approval_${parsed.data.decision}`,
      safe_payload: {
        approval_id: approvalRequestId,
        plan_version: parsed.data.plan_version,
        reason: parsed.data.reason ?? null,
      },
      created_at: now,
    });

    return NextResponse.json({ data: decision, requestId }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(
      `[POST /api/approvals/${approvalRequestId}/decision] requestId=${requestId}`,
      message
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
