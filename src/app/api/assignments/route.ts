/**
 * GET /api/assignments
 * Developer 4 (Anjali) owns this endpoint.
 *
 * Returns the scoped assignment queue for the authenticated staff member.
 * No cross-department or cross-institution data is returned.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/server/db/client";
import { getStaffAssignments } from "@/server/operations/assignments";
import { randomUUID } from "node:crypto";

export async function GET() {
  const requestId = randomUUID();

  try {
    const supabase = await createClient();

    // Verify authenticated session
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

    // Resolve membership for this user
    const { data: membership, error: memberError } = await supabase
      .from("institution_memberships")
      .select("id, institution_id, state")
      .eq("user_id", user.id)
      .eq("state", "active")
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        {
          error: {
            code: "NO_ACTIVE_MEMBERSHIP",
            message: "No active membership found",
          },
          requestId,
        },
        { status: 403 }
      );
    }

    const assignments = await getStaffAssignments(
      membership.id,
      membership.institution_id
    );

    return NextResponse.json({ data: assignments, requestId }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[GET /api/assignments] requestId=${requestId}`, message);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message }, requestId },
      { status: 500 }
    );
  }
}
