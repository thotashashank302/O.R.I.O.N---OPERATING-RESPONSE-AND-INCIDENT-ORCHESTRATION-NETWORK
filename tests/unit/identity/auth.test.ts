import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimStudentMembership } from "@/server/identity/roster";
import { verifyActiveMembershipAndRole } from "@/server/identity/roles";

vi.mock("@/server/db/client", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/server/db/client";

describe("Identity & Auth Invariants (ID-01 & ID-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ID-01: Roster-bound claim & Roll Impersonation Prevention", () => {
    it("rejects claim when institution does not exist", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "student@college.edu",
        "NONEXISTENT",
        "2024CSB101"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("institution does not exist");
    });

    it("rejects claim when institution is not approved", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "inst-1",
            name: "Pending Tech",
            approval_state: "pending",
          },
          error: null,
        }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "student@college.edu",
        "PENDING-TECH",
        "2024CSB101"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("pending administrator approval");
    });

    it("rejects claim when roll number is not in roster", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValueOnce({
            data: { id: "inst-1", approval_state: "approved" },
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: null }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "student@college.edu",
        "ORION-DEMO",
        "INVALID-ROLL"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("Roll number not found in institution roster");
    });

    it("rejects claim when email does not match the official roster email (ID-01)", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValueOnce({
            data: { id: "inst-1", approval_state: "approved" },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: "roster-1",
              institution_id: "inst-1",
              roll_number: "2024CSB101",
              roster_email: "actual.student@college.edu",
              department_id: "dept-1",
              section: "A",
              claimed_user_id: null,
            },
            error: null,
          }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "imposter@external.com",
        "ORION-DEMO",
        "2024CSB101"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("Email mismatch");
    });

    it("rejects claim when roll number has already been claimed by another account", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValueOnce({
            data: { id: "inst-1", approval_state: "approved" },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: "roster-1",
              institution_id: "inst-1",
              roll_number: "2024CSB101",
              roster_email: "student@college.edu",
              claimed_user_id: "other-user-999",
            },
            error: null,
          }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "student@college.edu",
        "ORION-DEMO",
        "2024CSB101"
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("already been claimed by another account");
    });

    it("succeeds when email, roll, and approved institution match", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValueOnce({
            data: { id: "inst-1", approval_state: "approved" },
            error: null,
          })
          .mockResolvedValueOnce({
            data: {
              id: "roster-1",
              institution_id: "inst-1",
              roll_number: "2024CSB101",
              roster_email: "valid.student@college.edu",
              department_id: "dept-cs-1",
              section: "A",
              claimed_user_id: null,
            },
            error: null,
          })
          .mockResolvedValueOnce({ data: null, error: null }) // existing membership
          .mockResolvedValueOnce({ data: null, error: null }), // existing role
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await claimStudentMembership(
        "user-123",
        "valid.student@college.edu",
        "ORION-DEMO",
        "2024CSB101"
      );

      expect(res.success).toBe(true);
      expect(res.departmentId).toBe("dept-cs-1");
      expect(res.section).toBe("A");
    });
  });

  describe("ID-04: Inactive Membership Enforcement", () => {
    it("blocks inactive memberships from executing operations", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "mem-inactive",
            user_id: "user-123",
            institution_id: "inst-1",
            status: "inactive",
          },
          error: null,
        }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await verifyActiveMembershipAndRole("mem-inactive", "staff");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("deactivated by an administrator");
    });

    it("permits active memberships with matching role", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ role: "staff" }],
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: "mem-active",
            user_id: "user-123",
            institution_id: "inst-1",
            status: "active",
          },
          error: null,
        }),
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await verifyActiveMembershipAndRole("mem-active", "staff");
      expect(res.valid).toBe(true);
    });
  });
});
