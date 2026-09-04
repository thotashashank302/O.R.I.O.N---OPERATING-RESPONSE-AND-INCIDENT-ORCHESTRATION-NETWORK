import { NextRequest, NextResponse } from "next/server";
import { approveInstitution } from "@/server/identity/institutions";
import { requireRequestContext } from "@/server/auth/request-context";
import { AuthorizationError } from "@/server/auth/authorization";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    await req.json().catch(() => ({}));
    const context = await requireRequestContext(req, ["principal", "admin"]);
    if (context.institutionId !== id) {
      throw new AuthorizationError("Institution is outside the selected context", "FORBIDDEN");
    }
    const result = await approveInstitution(id, context.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED_OR_NOT_FOUND", message: result.error }, requestId },
        { status: result.error?.includes("Unauthorized") ? 403 : 404 }
      );
    }

    return NextResponse.json({ data: result.data, requestId });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError || (err instanceof Error && err.message === "UNAUTHENTICATED")) {
      const code = err instanceof AuthorizationError ? err.code : "UNAUTHENTICATED";
      return NextResponse.json(
        { error: { code, message: err.message }, requestId },
        { status: code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Approval failed" }, requestId },
      { status: 500 }
    );
  }
}
