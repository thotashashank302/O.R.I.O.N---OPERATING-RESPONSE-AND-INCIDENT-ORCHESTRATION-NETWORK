import { NextRequest, NextResponse } from "next/server";
import { claimStudentMembership } from "@/server/identity/roster";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { user_id, email, institution_code, roll_number } = body;

    if (!email || !institution_code || !roll_number) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Missing required fields: email, institution_code, and roll_number are required",
          },
          requestId,
        },
        { status: 400 }
      );
    }

    const effectiveUserId = user_id || crypto.randomUUID();
    const result = await claimStudentMembership(
      effectiveUserId,
      email,
      institution_code,
      roll_number
    );

    if (!result.success) {
      const isMismatch = result.error?.includes("mismatch") || result.error?.includes("claimed");
      return NextResponse.json(
        { error: { code: isMismatch ? "IDENTITY_CLAIM_REJECTED" : "VALIDATION_FAILED", message: result.error }, requestId },
        { status: isMismatch ? 403 : 422 }
      );
    }

    return NextResponse.json(
      {
        data: {
          membership_id: result.membershipId,
          department_id: result.departmentId,
          section: result.section,
        },
        requestId,
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message || "Failed to claim membership" }, requestId },
      { status: 500 }
    );
  }
}
