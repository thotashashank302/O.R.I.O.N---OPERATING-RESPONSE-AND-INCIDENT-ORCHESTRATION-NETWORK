/**
 * PATCH /api/staff/me/availability
 * Developer 4 (Anjali) owns this endpoint.
 *
 * Staff self-availability control: Available / Busy / Off duty.
 * SEPARATE from admin-controlled Active/Inactive membership status.
 *
 * When going Off duty with open tasks, returns 409 with open_tasks
 * so the client can show a choice modal (keep / request handover).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/server/db/client";
import { updateAvailability } from "@/server/operations/availability";
import { randomUUID } from "crypto";

const AvailabilitySchema = z.object({
  state: z.enum(["available", "busy", "off_duty"]),
  open_task_choice: z.enum(["keep", "handover"]).optional(),
  expected_version: z.number().int().nonnegative(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();

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
      .select("id, institution_id, state")
      .eq("user_id", user.id)
      .eq("state", "active")
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        {
          error: { code: "NO_ACTIVE_MEMBERSHIP", message: "No active membership" },
          requestId,
        },
        { status: 403 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = AvailabilitySchema.safeParse(body);

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

    const result = await updateAvailability(
      membership.id,
      membership.institution_id,
      parsed.data
    );

    return NextResponse.json({ data: result, requestId }, { status: 200 });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "Internal error";
    const openTasks = (err as { open_tasks?: unknown[] }).open_tasks;

    if (status === 409) {
      // Return open tasks in the conflict response so client can show modal
      return NextResponse.json(
        {
          error: {
            code: "HAS_OPEN_TASKS",
            message,
            open_tasks: openTasks ?? [],
          },
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

    console.error(
      `[PATCH /api/staff/me/availability] requestId=${requestId}`,
      message
    );
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
