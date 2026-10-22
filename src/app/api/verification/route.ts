import { requireRequestContext, authorizationFailure } from "@/server/auth/request-context";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const { data, error } = await createSupabaseAdmin().rpc("orion_verification_queue", { actor_id: context.membershipId, tenant_id: context.institutionId });
    if (error) throw error;
    return Response.json({ data });
  } catch (error) {
    return authorizationFailure(error) ?? Response.json({ error: { message: "Verification queue is temporarily unavailable" } }, { status: 503 });
  }
}
