import { NextRequest, NextResponse } from "next/server";
import { createInstitution, listApprovedInstitutions } from "@/server/identity/institutions";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";

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
    const session = await createSupabaseSessionClient();
    const { data, error } = await session.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId }, { status: 401 });
    }
    const body = await req.json();
    const displayName = typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name
      : data.user.email ?? "Institution principal";
    const result = await createInstitution(body, { userId: data.user.id, displayName });

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
