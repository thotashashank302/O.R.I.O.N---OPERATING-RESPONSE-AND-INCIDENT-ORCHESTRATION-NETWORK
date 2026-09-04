import { NextRequest, NextResponse } from "next/server";
import { createInstitution, listApprovedInstitutions } from "@/server/identity/institutions";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const institutions = await listApprovedInstitutions();
    return NextResponse.json({ data: institutions, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to list institutions" }, requestId },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const result = await createInstitution(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to create institution" }, requestId },
      { status: 500 }
    );
  }
}
