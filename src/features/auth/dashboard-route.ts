import type { RoleEnum, UserContextResponse } from "@/contracts/identity";

const ROLE_DESTINATIONS: Array<{ roles: RoleEnum[]; path: string }> = [
  { roles: ["principal"], path: "/principal" },
  { roles: ["admin", "safeguarding_officer"], path: "/admin" },
  { roles: ["hod"], path: "/hod" },
  { roles: ["supervisor", "staff"], path: "/staff" },
  { roles: ["cr"], path: "/cr" },
  { roles: ["transport_admin"], path: "/transport" },
  { roles: ["president", "coordinator"], path: "/clubs" },
  { roles: ["student"], path: "/student" },
];

export function dashboardRouteForRoles(roles: RoleEnum[]): string | null {
  for (const destination of ROLE_DESTINATIONS) {
    if (destination.roles.some((role) => roles.includes(role))) return destination.path;
  }
  return null;
}

export function dashboardRouteForContexts(contexts: UserContextResponse): string | null {
  const active = contexts.active_context?.membership_status === "active"
    ? contexts.active_context
    : contexts.contexts.find((context) => context.membership_status === "active");
  return active ? dashboardRouteForRoles(active.roles.map((grant) => grant.role)) : null;
}
