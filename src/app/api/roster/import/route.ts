import { NextRequest, NextResponse } from "next/server";
import { importRosterRows } from "@/server/identity/roster";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { institution_id, rows } = body;

    if (!institution_id || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "institution_id and rows array are required" }, requestId },
        { status: 400 }
      );
    }

    const result = await importRosterRows(institution_id, rows);
    return NextResponse.json({ data: result, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to import roster" }, requestId },
      { status: 500 }
    );
  }
}
