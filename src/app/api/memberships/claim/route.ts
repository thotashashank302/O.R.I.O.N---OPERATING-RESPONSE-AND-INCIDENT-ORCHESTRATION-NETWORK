import { NextRequest, NextResponse } from "next/server";
import { claimStudentMembership } from "@/server/identity/roster";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const { institution_code, roll_number } = body;
    const session = await createSupabaseSessionClient();
    const { data, error } = await session.auth.getUser();

    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId },
        { status: 401 }
      );
    }

    if (!institution_code || !roll_number) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "institution_code and roll_number are required",
          },
          requestId,
        },
        { status: 400 }
      );
    }

    const result = await claimStudentMembership(
      data.user.id,
      data.user.email,
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
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to claim membership" }, requestId },
      { status: 500 }
    );
  }
}
