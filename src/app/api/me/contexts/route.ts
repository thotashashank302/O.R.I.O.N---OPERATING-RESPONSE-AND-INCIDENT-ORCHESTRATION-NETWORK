import { NextResponse } from "next/server";
import { getUserContexts } from "@/server/identity/roles";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const session = await createSupabaseSessionClient();
    const { data, error } = await session.auth.getUser();
    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Login required" }, requestId },
        { status: 401 }
      );
    }

    const displayName = typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name
      : "";
    const contexts = await getUserContexts(data.user.id, data.user.email, displayName);
    if (!contexts) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User contexts not found" }, requestId },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contexts, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to fetch user contexts" }, requestId },
      { status: 500 }
    );
  }
}
