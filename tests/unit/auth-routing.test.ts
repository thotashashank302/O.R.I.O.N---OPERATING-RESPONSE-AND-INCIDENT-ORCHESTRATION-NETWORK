import { describe, expect, it } from "vitest";
import { dashboardRouteForContexts, dashboardRouteForRoles } from "@/features/auth/dashboard-route";

describe("authenticated dashboard routing", () => {
  it("does not grant a dashboard when there are no active roles", () => {
    expect(dashboardRouteForRoles([])).toBeNull();
  });

  it("routes by authoritative roles rather than email text", () => {
    expect(dashboardRouteForRoles(["student"])).toBe("/student");
    expect(dashboardRouteForRoles(["staff"])).toBe("/staff");
    expect(dashboardRouteForRoles(["admin", "student"])).toBe("/admin");
  });

  it("ignores inactive memberships", () => {
    expect(dashboardRouteForContexts({
      user_id: "user-1",
      email: "person@example.com",
      display_name: "Person",
      active_context: null,
      contexts: [{
        institution_id: "institution-1",
        institution_name: "Example College",
        institution_code: "EXAMPLE",
        membership_id: "membership-1",
        membership_status: "inactive",
        roles: [{ role: "admin" }],
      }],
    })).toBeNull();
  });
});
