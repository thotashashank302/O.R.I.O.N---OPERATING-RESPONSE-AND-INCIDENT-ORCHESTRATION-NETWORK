import { NextRequest, NextResponse } from "next/server";
import { revokeRole } from "@/server/identity/roles";
import { requireRequestContext } from "@/server/auth/request-context";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const context = await requireRequestContext(req, ["principal", "admin", "hod"]);
    const body = await req.json();

    const { reason, replacement_membership_id } = body;

    if (!reason) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "reason is required",
          },
          requestId,
        },
        { status: 400 }
      );
    }

    const result = await revokeRole(
      context.membershipId,
      id,
      reason,
      replacement_membership_id
    );

    if (!result.success) {
      const isForbidden = result.error?.includes("Unauthorized");
      return NextResponse.json(
        { error: { code: isForbidden ? "FORBIDDEN" : "VALIDATION_FAILED", message: result.error }, requestId },
        { status: isForbidden ? 403 : 422 }
      );
    }

    return NextResponse.json({ data: { success: true, grant_id: id }, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to revoke role" }, requestId },
      { status: 500 }
    );
  }
}
