import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthorizedContext, Role } from "@/contracts/domain";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { createSupabaseSessionClient } from "./supabase-session";
import { AuthorizationError, requireFreshContext } from "./authorization";

export class AuthorizationUnavailableError extends Error {
  constructor() { super("Authorization service is temporarily unavailable"); }
}

export function authorizationFailure(error: unknown): Response | null {
  if (error instanceof AuthorizationError) {
    return Response.json({ error: { code: error.code, message: error.message }, requestId: randomUUID() }, {
      status: error.code === "UNAUTHENTICATED" ? 401 : 403,
    });
  }
  return error instanceof AuthorizationUnavailableError
    ? Response.json({ error: { code: "AUTHORIZATION_UNAVAILABLE", message: error.message }, requestId: randomUUID() }, { status: 503 })
    : null;
}

const idSchema = z.string().uuid();

export async function requireRequestContext(request: Request, requiredRoles: readonly Role[] = []): Promise<AuthorizedContext> {
  const session = await createSupabaseSessionClient();
  const { data, error } = await session.auth.getUser();
  if (error || !data.user) throw new AuthorizationError("Authentication required", "UNAUTHENTICATED");
  const institution = idSchema.safeParse(request.headers.get("x-orion-institution-id"));
  const membership = idSchema.safeParse(request.headers.get("x-orion-membership-id"));
  if (!institution.success || !membership.success) {
    throw new AuthorizationError("Select a valid campus membership before continuing", "STALE_CONTEXT");
  }
  const institutionId = institution.data;
  const membershipId = membership.data;
  const admin = createSupabaseAdmin();
  return requireFreshContext({
    async findMembership(userId, selectedMembershipId) {
      const { data: membership, error: membershipError } = await admin.from("institution_memberships")
        .select("id,user_id,institution_id,status")
        .eq("id", selectedMembershipId).eq("user_id", userId).maybeSingle();
      if (membershipError) throw new AuthorizationUnavailableError();
      if (!membership) return null;
      const { data: grants, error: grantError } = await admin.from("role_grants")
        .select("role,department_id,section_id,starts_at,ends_at,revoked_at")
        .eq("membership_id", selectedMembershipId);
      if (grantError) throw new AuthorizationUnavailableError();
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
