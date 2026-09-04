import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantRole, revokeRole } from "@/server/identity/roles";

vi.mock("@/server/db/client", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/server/db/client";

describe("Role Administration & Dual-Seat CR Invariants (ID-02 & CORE-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createFluentMockDb = (config: {
    maybeSingleReturns?: any[];
    isData?: any;
  }) => {
    let maybeSingleIdx = 0;
    const maybeSingleFn = vi.fn().mockImplementation(() => {
      const val = config.maybeSingleReturns
        ? config.maybeSingleReturns[maybeSingleIdx++]
        : null;
      return Promise.resolve({ data: val, error: null });
    });

    const mock: any = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: maybeSingleFn,
      is: vi.fn().mockImplementation(() => ({
        maybeSingle: maybeSingleFn,
        then: (resolve: any) =>
          resolve({ data: config.isData || [], error: null }),
      })),
    };

    return mock;
  };

  describe("ID-02: Privileged Role Grant Boundaries", () => {
    it("denies user self-assigning privileged roles", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          { id: "mem-1", institution_id: "inst-1", status: "active" },
          { id: "mem-1", institution_id: "inst-1", status: "active" },
        ],
      });
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await grantRole("mem-1", {
        membership_id: "mem-1",
        role: "admin",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Users cannot self-assign privileged");
    });

    it("denies role grant across different institutions", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          { id: "mem-1", institution_id: "inst-1", status: "active" },
          { id: "mem-2", institution_id: "inst-2", status: "active" },
        ],
      });
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await grantRole("mem-1", {
        membership_id: "mem-2",
        role: "staff",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Target member belongs to a different institution");
    });

    it("denies HOD granting CR in another department", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          { id: "mem-hod", institution_id: "inst-1", status: "active" },
          { id: "mem-1", institution_id: "inst-1", status: "active" },
        ],
        isData: [{ role: "hod", department_id: "dept-cs" }],
      });
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await grantRole("mem-hod", {
        membership_id: "mem-1",
        role: "cr",
        department_id: "dept-ee", // WRONG DEPT
        section: "A",
        seat_number: 1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });
  });

  describe("CORE-02: Two CR Seats Per Section & Revocation", () => {
    it("allows appointing Seat 1 and Seat 2 in the same section", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          { id: "mem-admin", institution_id: "inst-1", status: "active" },
          { id: "mem-1", institution_id: "inst-1", status: "active" },
          null, // Seat 1 not occupied
        ],
        isData: [{ role: "admin" }],
      });

      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await grantRole("mem-admin", {
        membership_id: "mem-1",
        role: "cr",
        department_id: "dept-cs",
        section: "A",
        seat_number: 1,
      });

      expect(res.success).toBe(true);
      expect(res.data?.seat_number).toBe(1);
    });

    it("rejects appointing to an already occupied seat", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          { id: "mem-admin", institution_id: "inst-1", status: "active" },
          { id: "mem-2", institution_id: "inst-1", status: "active" },
          { id: "existing-grant", membership_id: "mem-1" }, // Seat 1 occupied
        ],
        isData: [{ role: "admin" }],
      });

      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await grantRole("mem-admin", {
        membership_id: "mem-2",
        role: "cr",
        department_id: "dept-cs",
        section: "A",
        seat_number: 1,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("CR Seat 1 is already actively occupied");
    });

    it("reassigns stranded verifications when a CR is revoked", async () => {
      const mockDb = createFluentMockDb({
        maybeSingleReturns: [
          {
            id: "grant-cr1",
            role: "cr",
            department_id: "dept-cs",
            section: "A",
            seat_number: 1,
            membership_id: "mem-cr1",
          },
          { id: "mem-hod", institution_id: "inst-1", status: "active" },
          { membership_id: "mem-cr2" }, // remaining CR
        ],
        isData: [{ role: "hod", department_id: "dept-cs" }],
      });

      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await revokeRole("mem-hod", "grant-cr1", "Graduated / Term Ended");
      expect(res.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
