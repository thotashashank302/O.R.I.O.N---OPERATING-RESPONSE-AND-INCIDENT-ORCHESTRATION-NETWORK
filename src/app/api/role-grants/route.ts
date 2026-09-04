import { NextRequest, NextResponse } from "next/server";
import { grantRole } from "@/server/identity/roles";
import { requireRequestContext } from "@/server/auth/request-context";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req, ["principal", "admin", "hod"]);
    const grantInput = await req.json();

    const result = await grantRole(context.membershipId, grantInput);

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
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to grant role" }, requestId },
      { status: 500 }
    );
  }
}
