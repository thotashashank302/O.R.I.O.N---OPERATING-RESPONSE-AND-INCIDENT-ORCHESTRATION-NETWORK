import { NextRequest, NextResponse } from "next/server";
import { addRosterRow } from "@/server/identity/roster";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { institution_id, ...rowData } = body;

    if (!institution_id) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "institution_id is required" }, requestId },
        { status: 400 }
      );
    }

    const result = await addRosterRow(institution_id, rowData);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message || "Failed to add roster row" }, requestId },
      { status: 500 }
    );
  }
}
