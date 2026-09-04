import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthorizedContext, Role } from "@/contracts/domain";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseSessionClient } from "./supabase-session";
import { requireFreshContext } from "./authorization";

const idSchema = z.string().uuid();

export async function requireRequestContext(request: Request, requiredRoles: readonly Role[] = []): Promise<AuthorizedContext> {
  const institutionId = idSchema.parse(request.headers.get("x-orion-institution-id"));
  const membershipId = idSchema.parse(request.headers.get("x-orion-membership-id"));
  const session = await createSupabaseSessionClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) throw new Error("UNAUTHENTICATED");
  const admin = createSupabaseAdmin();
  return requireFreshContext({
    async findMembership(userId, selectedMembershipId) {
      const { data: membership } = await admin.from("institution_memberships")
        .select("id,user_id,institution_id,status")
        .eq("id", selectedMembershipId).eq("user_id", userId).single();
      if (!membership) return null;
      const { data: grants } = await admin.from("role_grants")
        .select("role,department_id,section_id,starts_at,ends_at,revoked_at")
        .eq("membership_id", selectedMembershipId);
      return {
        id: membership.id,
        userId: membership.user_id,
        institutionId: membership.institution_id,
        status: membership.status,
        roles: (grants ?? []).map((grant) => ({
          role: grant.role as Role,
          departmentId: grant.department_id,
          sectionId: grant.section_id,
          startsAt: new Date(grant.starts_at),
          endsAt: grant.ends_at ? new Date(grant.ends_at) : null,
          revokedAt: grant.revoked_at ? new Date(grant.revoked_at) : null,
        })),
      };
    },
  }, { requestId: request.headers.get("x-request-id") ?? randomUUID(), userId: data.user.id, membershipId, institutionId }, requiredRoles);
}
