import { NextRequest, NextResponse } from "next/server";
import { approveInstitution } from "@/server/identity/institutions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  try {
    const { id } = await params;
    const body = await req.json();

    const adminEmail = body.admin_email || "demo.admin@orion.edu";
    const result = await approveInstitution(id, adminEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED_OR_NOT_FOUND", message: result.error }, requestId },
        { status: result.error?.includes("Unauthorized") ? 403 : 404 }
      );
    }

    return NextResponse.json({ data: result.data, requestId });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message || "Approval failed" }, requestId },
      { status: 500 }
    );
  }
}
