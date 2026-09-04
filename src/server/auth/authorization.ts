import type { AuthorizedContext, Role } from "@/contracts/domain";

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "INACTIVE_MEMBERSHIP" | "STALE_CONTEXT",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface MembershipRecord {
  id: string;
  userId: string;
  institutionId: string;
  status: "active" | "inactive";
  roles: Array<{ role: Role; departmentId: string | null; startsAt: Date; endsAt: Date | null; revokedAt: Date | null }>;
}

export interface AuthorizationStore {
  findMembership(userId: string, membershipId: string): Promise<MembershipRecord | null>;
}

/** Always reloads membership and role grants. JWT metadata is never an authorization source. */
export async function requireFreshContext(
  store: AuthorizationStore,
  claimed: Pick<AuthorizedContext, "requestId" | "userId" | "membershipId" | "institutionId">,
  requiredRoles: readonly Role[] = [],
  now = new Date(),
): Promise<AuthorizedContext> {
  const membership = await store.findMembership(claimed.userId, claimed.membershipId);
  if (!membership) throw new AuthorizationError("Membership was not found", "UNAUTHENTICATED");
  if (membership.institutionId !== claimed.institutionId) {
    throw new AuthorizationError("Selected institution is stale", "STALE_CONTEXT");
  }
  if (membership.status !== "active") {
    throw new AuthorizationError("Membership is inactive", "INACTIVE_MEMBERSHIP");
  }

  const grants = membership.roles.filter((grant) =>
    !grant.revokedAt && grant.startsAt <= now && (!grant.endsAt || grant.endsAt > now),
  );
  const roles = [...new Set(grants.map((grant) => grant.role))];
  if (requiredRoles.length > 0 && !requiredRoles.some((role) => roles.includes(role))) {
    throw new AuthorizationError("Current membership lacks the required role", "FORBIDDEN");
  }

  return {
    ...claimed,
    roles,
    departmentIds: [...new Set(grants.flatMap((grant) => grant.departmentId ? [grant.departmentId] : []))],
    sectionIds: [],
  };
}

export function assertSameInstitution(context: AuthorizedContext, resourceInstitutionId: string): void {
  if (context.institutionId !== resourceInstitutionId) {
    throw new AuthorizationError("Resource is outside the selected institution", "FORBIDDEN");
  }
}
