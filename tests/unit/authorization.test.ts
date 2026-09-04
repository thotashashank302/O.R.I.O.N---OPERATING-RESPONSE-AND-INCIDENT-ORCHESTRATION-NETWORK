import { describe, expect, it } from "vitest";
import { requireFreshContext, type AuthorizationStore } from "@/server/auth/authorization";

const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  member: "20000000-0000-4000-8000-000000000001",
  college: "30000000-0000-4000-8000-000000000001",
  other: "30000000-0000-4000-8000-000000000002",
};

function store(status: "active" | "inactive" = "active"): AuthorizationStore {
  return {
    async findMembership() {
      return {
        id: ids.member,
        userId: ids.user,
        institutionId: ids.college,
        status,
        roles: [{ role: "hod", departmentId: null, startsAt: new Date("2026-01-01"), endsAt: null, revokedAt: null }],
      };
    },
  };
}

describe("fresh authorization", () => {
  it("rechecks and returns active database grants", async () => {
    const context = await requireFreshContext(store(), { requestId: "r1", userId: ids.user, membershipId: ids.member, institutionId: ids.college }, ["hod"], new Date("2026-09-04"));
    expect(context.roles).toEqual(["hod"]);
  });

  it("blocks an inactive membership despite an existing identity", async () => {
    await expect(requireFreshContext(store("inactive"), { requestId: "r2", userId: ids.user, membershipId: ids.member, institutionId: ids.college })).rejects.toMatchObject({ code: "INACTIVE_MEMBERSHIP" });
  });

  it("blocks a stale cross-tenant context", async () => {
    await expect(requireFreshContext(store(), { requestId: "r3", userId: ids.user, membershipId: ids.member, institutionId: ids.other })).rejects.toMatchObject({ code: "STALE_CONTEXT" });
  });
});
