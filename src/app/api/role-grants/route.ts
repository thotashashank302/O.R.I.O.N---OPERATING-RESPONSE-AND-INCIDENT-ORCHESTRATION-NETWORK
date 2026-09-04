import { NextRequest, NextResponse } from "next/server";
import { grantRole } from "@/server/identity/roles";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { granted_by_membership_id, ...grantInput } = body;

    if (!granted_by_membership_id) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "granted_by_membership_id is required" }, requestId },
        { status: 400 }
      );
    }

    const result = await grantRole(granted_by_membership_id, grantInput);

    if (!result.success) {
      const isForbidden =
        result.error?.includes("self-assign") ||
        result.error?.includes("Unauthorized") ||
        result.error?.includes("permission");

      return NextResponse.json(
        { error: { code: isForbidden ? "FORBIDDEN" : "VALIDATION_FAILED", message: result.error }, requestId },
        { status: isForbidden ? 403 : 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message || "Failed to grant role" }, requestId },
      { status: 500 }
    );
  }
}
