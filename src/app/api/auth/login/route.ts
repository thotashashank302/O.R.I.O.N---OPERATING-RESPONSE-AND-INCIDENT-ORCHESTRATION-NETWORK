import { NextResponse } from "next/server";
import { z } from "zod";
import { dashboardRouteForContexts } from "@/features/auth/dashboard-route";
import { createSupabaseSessionClient } from "@/server/auth/supabase-session";
import { getUserContexts } from "@/server/identity/roles";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
}).strict();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_LOGIN", message: "Enter a valid email and password." }, requestId },
      { status: 422 },
    );
  }

  try {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user?.email) {
      return NextResponse.json(
        { error: { code: "INVALID_LOGIN", message: "Invalid email or password." }, requestId },
        { status: 401 },
      );
    }

    const displayName = typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name
      : "";
    const contexts = await getUserContexts(data.user.id, data.user.email, displayName);
    const destination = contexts ? dashboardRouteForContexts(contexts) : null;
    if (!contexts || !destination) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: { code: "NO_ACTIVE_MEMBERSHIP", message: "Your account has no active ORION membership." }, requestId },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: { destination }, requestId });
  } catch (error) {
    console.error(`[POST /api/auth/login] requestId=${requestId}`, error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE", message: "Sign-in is temporarily unavailable. Please try again." }, requestId },
      { status: 503 },
    );
  }
}
