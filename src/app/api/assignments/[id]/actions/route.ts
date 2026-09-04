import { kickWorker } from "@/server/orchestration/kick";
export const maxDuration = 300;
import { activeMembership } from "@/server/auth/active-membership";
/**
 * POST /api/assignments/[id]/actions
 * Developer 4 (Anjali) owns this endpoint.
 *
 * Performs assignment state transitions:
 * acknowledge | start | block | submit | handover
 *
 * Uses optimistic locking via expected_version.
 * This is the SHARED acknowledge service also used by D5's email confirmation.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/server/db/client";
import { performAssignmentAction } from "@/server/operations/assignment-actions";
import { randomUUID } from "crypto";

const ActionSchema = z.object({
  action: z.enum(["acknowledge", "start", "block", "submit", "handover"]),
  expected_version: z.number().int().nonnegative(),
  reason: z.string().max(500).optional(),
  block_reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id: assignmentId } = await params;

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
    const { data: membership, error: memberError } = await activeMembership(supabase, user.id);

    if (memberError || !membership) {
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_MEMBERSHIP", message: "No active membership" }, requestId },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request",
            details: parsed.error.flatten(),
          },
          requestId,
        },
        { status: 422 }
      );
    }

    // Block reason required for block action
    if (
      parsed.data.action === "block" &&
      !parsed.data.block_reason?.trim()
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "block_reason is required when blocking",
          },
          requestId,
        },
        { status: 422 }
      );
    }

    const updated = await performAssignmentAction(
      assignmentId,
      membership.id,
      parsed.data
    );

    kickWorker("assignment-action");
    return NextResponse.json({ data: updated, requestId }, { status: 200 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Internal error";

    if (status === 409) {
      return NextResponse.json(
        {
          error: { code: "VERSION_CONFLICT", message },
          requestId,
        },
        { status: 409 }
      );
    }

    if (status === 404) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message }, requestId },
        { status: 404 }
      );
    }

    if (status === 422) {
      return NextResponse.json(
        { error: { code: "INVALID_TRANSITION", message }, requestId },
        { status: 422 }
      );
    }

    console.error(
      `[POST /api/assignments/${assignmentId}/actions] requestId=${requestId}`,
      message
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
