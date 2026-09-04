import { NextRequest, NextResponse } from "next/server";
import { createClubTerm } from "@/server/identity/eligibility";
import { requireRequestContext } from "@/server/auth/request-context";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req, ["principal", "admin"]);
    const termData = await req.json();

    const result = await createClubTerm(context.institutionId, termData, context.membershipId);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to create club term" }, requestId },
      { status: 500 }
    );
  }
}
