import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  checkConfidentialCaseAccess,
  updateStaffCapabilities,
} from "@/server/identity/eligibility";

vi.mock("@/server/db/client", () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from "@/server/db/client";

describe("Staff Eligibility & Confidential Access (RP-03 & B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RP-03: Confidential Case Access Control", () => {
    const reporterId = "mem-student-reporter";
    const accusedStaffId = "mem-staff-accused";
    const neutralPrincipalId = "mem-principal";
    const ordinaryStudentId = "mem-other-student";

    it("DENIES access to accused staff or CR (RP-03)", () => {
      const res = checkConfidentialCaseAccess(
        reporterId,
        [accusedStaffId],
        accusedStaffId,
        false
      );

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("Access denied: You are named in this confidential record");
    });

    it("ALLOWS access to the reporter who filed the complaint", () => {
      const res = checkConfidentialCaseAccess(
        reporterId,
        [accusedStaffId],
        reporterId,
        false
      );

      expect(res.allowed).toBe(true);
    });

    it("ALLOWS access to an authorized non-conflicted Principal/Admin", () => {
      const res = checkConfidentialCaseAccess(
        reporterId,
        [accusedStaffId],
        neutralPrincipalId,
        true
      );

      expect(res.allowed).toBe(true);
    });

    it("DENIES access to third-party uninvolved students/staff", () => {
      const res = checkConfidentialCaseAccess(
        reporterId,
        [accusedStaffId],
        ordinaryStudentId,
        false
      );

      expect(res.allowed).toBe(false);
    });
  });

  describe("B2: Staff Capability Initialization", () => {
    it("starts new staff as off_duty by default", async () => {
      const mockDb: any = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn()
          .mockResolvedValueOnce({ data: { institution_id: "inst-1" }, error: null })
          .mockResolvedValueOnce({ data: null, error: null }), // No existing capabilities
      };
      (createServiceClient as any).mockResolvedValue(mockDb);

      const res = await updateStaffCapabilities("mem-staff-1", {
        skills: ["electrical_repair", "hvac"],
        zones: ["zone-north-block", "zone-lab-complex"],
        workload_limit: 4,
      });

      expect(res.success).toBe(true);
      expect(res.data?.availability).toBe("off_duty");
      expect(res.data?.skills).toContain("electrical_repair");
    });
  });
});
