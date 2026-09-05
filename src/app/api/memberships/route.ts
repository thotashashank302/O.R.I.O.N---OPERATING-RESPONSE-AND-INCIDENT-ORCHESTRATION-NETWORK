import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { requireRequestContext } from "@/server/auth/request-context";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req);
    const db = createSupabaseAdmin();

    const [membersRes, grantsRes, usersRes] = await Promise.all([
      db.from("institution_memberships").select("id, user_id, status, created_at").eq("institution_id", context.institutionId),
      db.from("role_grants").select("membership_id, role").eq("institution_id", context.institutionId).is("revoked_at", null),
      db.auth.admin.listUsers(),
    ]);

    const userMap = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u]));
    const grantsMap = new Map<string, string[]>();
    for (const g of grantsRes.data ?? []) {
      const list = grantsMap.get(g.membership_id) ?? [];
      list.push(g.role);
      grantsMap.set(g.membership_id, list);
    }

    const members = (membersRes.data ?? []).map((m) => {
      const u = userMap.get(m.user_id);
      const email = u?.email ?? "unknown@campus.edu";
      const name = (u?.user_metadata?.name as string) ?? email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id: m.id,
        name,
        email,
        roles: grantsMap.get(m.id) ?? ["student"],
        status: m.status as "active" | "inactive",
      };
    });

    return NextResponse.json({ data: members, requestId }, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to list members" }, requestId },
      { status: 500 }
    );
  }
}
