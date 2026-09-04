import { NextRequest, NextResponse } from "next/server";
import { importRosterRows } from "@/server/identity/roster";
import { requireRequestContext } from "@/server/auth/request-context";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req, ["principal", "admin"]);
    const body = await req.json();
    const { rows } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "rows array is required" }, requestId },
        { status: 400 }
      );
    }

    const result = await importRosterRows(context.institutionId, rows);
    return NextResponse.json({ data: result, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to import roster" }, requestId },
      { status: 500 }
    );
  }
}
