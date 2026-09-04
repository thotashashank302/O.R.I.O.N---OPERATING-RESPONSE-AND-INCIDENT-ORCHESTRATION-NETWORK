import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/server/db/client";
import { MembershipStatusPatchSchema } from "@/contracts/identity";
import { requireRequestContext } from "@/server/auth/request-context";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const context = await requireRequestContext(req, ["principal", "admin"]);
    const body = await req.json();

    const parsed = MembershipStatusPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: parsed.error.issues[0].message }, requestId },
        { status: 422 }
      );
    }

    const db = await createServiceClient();

    const { data: updated, error } = await db
      .from("institution_memberships")
      .update({
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("institution_id", context.institutionId)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Membership not found or update failed" }, requestId },
        { status: 404 }
      );
    }

    // If deactivated, also transition any active staff capability state
    if (parsed.data.status === "inactive") {
      await db
        .from("staff_capabilities")
        .update({ availability: "off_duty", updated_at: new Date().toISOString() })
        .eq("membership_id", id);
    }

    return NextResponse.json({ data: updated, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to update membership status" }, requestId },
      { status: 500 }
    );
  }
}
