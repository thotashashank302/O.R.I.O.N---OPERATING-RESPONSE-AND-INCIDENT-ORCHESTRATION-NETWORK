import { NextRequest, NextResponse } from "next/server";
import { revokeRole } from "@/server/identity/roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const body = await req.json();

    const { revoked_by_membership_id, reason, replacement_membership_id } = body;

    if (!revoked_by_membership_id || !reason) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "revoked_by_membership_id and reason are required",
          },
          requestId,
        },
        { status: 400 }
      );
    }

    const result = await revokeRole(
      revoked_by_membership_id,
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
