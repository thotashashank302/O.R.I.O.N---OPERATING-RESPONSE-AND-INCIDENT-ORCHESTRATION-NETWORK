import { NextResponse } from "next/server";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";

export async function POST() {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createSupabaseSessionClient();
    await supabase.auth.signOut();
    return NextResponse.json({ data: { signedOut: true }, requestId });
  } catch (error) {
    console.error(`[POST /api/auth/logout] requestId=${requestId}`, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: { code: "LOGOUT_FAILED", message: "Sign-out failed. Please try again." }, requestId },
      { status: 500 },
    );
  }
}
