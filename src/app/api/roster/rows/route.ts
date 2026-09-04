import { NextRequest, NextResponse } from "next/server";
import { addRosterRow } from "@/server/identity/roster";
import { requireRequestContext } from "@/server/auth/request-context";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req, ["principal", "admin"]);
    const rowData = await req.json();

    const result = await addRosterRow(context.institutionId, rowData);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to add roster row" }, requestId },
      { status: 500 }
    );
  }
}
