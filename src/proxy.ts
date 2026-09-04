import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/contracts/database";
import type { RoleEnum } from "@/contracts/identity";
import { dashboardRouteForRoles } from "@/features/auth/dashboard-route";

const ROUTE_ROLES: Record<string, RoleEnum[]> = {
  "/principal": ["principal"],
  "/admin": ["admin", "safeguarding_officer"],
  "/hod": ["hod"],
  "/staff": ["supervisor", "staff"],
  "/cr": ["cr"],
  "/transport": ["transport_admin"],
  "/clubs": ["president", "coordinator"],
  "/student": ["student"],
};

function redirectWithCookies(request: NextRequest, target: string, source: NextResponse) {
  const redirect = NextResponse.redirect(new URL(target, request.url));
  for (const cookie of source.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return redirectWithCookies(request, "/login?error=auth_unavailable", response);

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return redirectWithCookies(request, "/login", response);

  const { data: memberships, error: membershipError } = await supabase
    .from("institution_memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (membershipError) return redirectWithCookies(request, "/login?error=authorization_failed", response);
  if (!memberships?.length) return redirectWithCookies(request, "/register", response);

  const { data: grants, error: grantError } = await supabase
    .from("role_grants")
    .select("role, starts_at, ends_at")
    .in("membership_id", memberships.map((membership) => membership.id))
    .is("revoked_at", null);
  if (grantError) return redirectWithCookies(request, "/login?error=authorization_failed", response);

  const now = Date.now();
  const roles = (grants ?? [])
    .filter((grant) => Date.parse(grant.starts_at) <= now && (!grant.ends_at || Date.parse(grant.ends_at) > now))
    .map((grant) => grant.role as RoleEnum);
  const route = Object.keys(ROUTE_ROLES).find((prefix) => request.nextUrl.pathname.startsWith(prefix));
  if (route && !ROUTE_ROLES[route].some((role) => roles.includes(role))) {
    return redirectWithCookies(request, dashboardRouteForRoles(roles) ?? "/register", response);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/principal/:path*",
    "/hod/:path*",
    "/staff/:path*",
    "/student/:path*",
    "/cr/:path*",
    "/clubs/:path*",
    "/transport/:path*",
    "/incidents/:path*",
  ],
};
