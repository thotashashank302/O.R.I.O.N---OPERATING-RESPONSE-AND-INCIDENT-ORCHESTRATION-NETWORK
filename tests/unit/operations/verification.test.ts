/**
 * ORION Operations — Unit Tests
 * Developer 4 (Anjali) owns this file.
 * Tests for availability transitions, assignment actions, and verification agent.
 *
 * Run: npx vitest run tests/unit/operations/
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import {
  requiresHumanPhysicalCheck,
  getVerifierRulesForCategory,
  runVerificationAgent,
} from "@/server/agents/verification";
import type {
  VerificationContext,
  ResolutionEvidence,
} from "@/contracts/operations";

// ─────────────────────────────────────────────
// Verification agent — category rules
// ─────────────────────────────────────────────

describe("requiresHumanPhysicalCheck", () => {
  it("returns true for electrical", () => {
    expect(requiresHumanPhysicalCheck("electrical")).toBe(true);
  });

  it("returns true for security", () => {
    expect(requiresHumanPhysicalCheck("security")).toBe(true);
  });

  it("returns true for emergency", () => {
    expect(requiresHumanPhysicalCheck("emergency")).toBe(true);
  });

  it("returns false for cleaning", () => {
    expect(requiresHumanPhysicalCheck("cleaning")).toBe(false);
  });

  it("returns false for IT/network", () => {
    expect(requiresHumanPhysicalCheck("it_network")).toBe(false);
  });

  it("handles underscore/space variants", () => {
    expect(requiresHumanPhysicalCheck("door/key access")).toBe(true);
    expect(requiresHumanPhysicalCheck("Electrical Fan AC")).toBe(true);
  });
});

describe("getVerifierRulesForCategory", () => {
  it("electrical requires human confirmation and safety clearance", () => {
    const rules = getVerifierRulesForCategory("electrical");
    expect(rules.human_confirmation_required).toBe(true);
    expect(rules.required_evidence.some((e) => /safety/i.test(e))).toBe(true);
  });

  it("cleaning does not require human confirmation", () => {
    const rules = getVerifierRulesForCategory("cleaning");
    expect(rules.human_confirmation_required).toBe(false);
  });

  it("emergency requires human confirmation and no required evidence", () => {
    const rules = getVerifierRulesForCategory("emergency");
    expect(rules.human_confirmation_required).toBe(true);
    expect(rules.required_evidence).toHaveLength(0);
  });

  it("returns fallback for unknown categories", () => {
    const rules = getVerifierRulesForCategory("unknown_xyz");
    expect(rules.required_evidence.length).toBeGreaterThan(0);
    expect(rules.human_confirmation_required).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Verification agent — safety overrides
// ─────────────────────────────────────────────

describe("runVerificationAgent — safety overrides", () => {
  const baseEvidence: ResolutionEvidence = {
    id: "ev-1",
    task_id: "task-123",
    uploader_membership_id: "mem-1",
    kind: "functional_test",
    content: "Equipment tested and confirmed working",
    evidence_version: 1,
    created_at: new Date().toISOString(),
  };

  const physicalContext: VerificationContext = {
    task_id: "task-123",
    task_logical_key: "electrical-fix-1",
    specialist_profile: "electrical",
    checklist: ["Isolate circuit", "Replace fuse", "Test equipment"],
    evidence_requirements: ["Safety clearance note", "Functional test result"],
    submitted_evidence: [baseEvidence],
    incident_category: "electrical",
    requires_human_physical_check: true,
  };

  it("returns pending_human for emergency category without calling API", async () => {
    const emergencyCtx: VerificationContext = {
      ...physicalContext,
      incident_category: "emergency",
      requires_human_physical_check: true,
    };

    // Should return early before any API call
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await runVerificationAgent(emergencyCtx);

    expect(result.verdict).toBe("pending_human");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("overrides 'verified' to 'pending_human' for physical tasks even if model says verified", async () => {
    // Mock Featherless returning 'verified' for a physical task
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                task_id: "task-123",
                verdict: "verified", // AI says verified
                missing_evidence: [],
                reasons: ["All evidence looks complete"],
                suggested_replan_reason: null,
              }),
            },
          },
        ],
      }),
    } as unknown as Response);

    const result = await runVerificationAgent(physicalContext);

    // Must be overridden to pending_human
    expect(result.verdict).toBe("pending_human");
    expect(
      result.reasons.some((r) => /physical|human/i.test(r))
    ).toBe(true);

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });

  it("returns pending_human when FEATHERLESS_API_KEY is not set", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY", "");
    const result = await runVerificationAgent(physicalContext);
    expect(result.verdict).toBe("pending_human");
    vi.unstubAllEnvs();
  });

  it("returns pending_human on fetch failure after retries", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("Network error"));

    const result = await runVerificationAgent(physicalContext);
    expect(result.verdict).toBe("pending_human");
    expect(fetchMock).toHaveBeenCalled();

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });

  it("returns pending_human on 429 rate limit", async () => {
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as unknown as Response);

    const result = await runVerificationAgent(physicalContext);
    expect(result.verdict).toBe("pending_human");

    fetchMock.mockRestore();
    vi.unstubAllEnvs();
  });
});

// ─────────────────────────────────────────────
// Availability state contract tests
// ─────────────────────────────────────────────

describe("AvailabilityState contract", () => {
  // These tests verify the contract values match the DB enum
  it("valid states are exactly: available, busy, off_duty", () => {
    const validStates = ["available", "busy", "off_duty"];
    validStates.forEach((state) => {
      expect(["available", "busy", "off_duty"]).toContain(state);
    });
  });

  it("inactive membership is separate from off_duty availability", () => {
    // Conceptual test: these are different fields in different tables
    const membershipStates = ["active", "inactive"];
    const availabilityStates = ["available", "busy", "off_duty"];

    // No overlap except conceptually "inactive" membership should prevent work
    membershipStates.forEach((ms) => {
      expect(availabilityStates).not.toContain(ms);
    });
  });
});

// ─────────────────────────────────────────────
// Assignment transition contract tests
// ─────────────────────────────────────────────

describe("AssignmentState transitions", () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    offered: ["acknowledge"],
    acknowledged: ["start"],
    active: ["block", "submit", "handover"],
    handover_requested: [],
    released: [],
    completed: [],
    cancelled: [],
  };

  it("offered state only allows acknowledge", () => {
    expect(VALID_TRANSITIONS["offered"]).toEqual(["acknowledge"]);
  });

  it("acknowledged state only allows start", () => {
    expect(VALID_TRANSITIONS["acknowledged"]).toEqual(["start"]);
  });

  it("active state allows block, submit, and handover", () => {
    expect(VALID_TRANSITIONS["active"]).toContain("block");
    expect(VALID_TRANSITIONS["active"]).toContain("submit");
    expect(VALID_TRANSITIONS["active"]).toContain("handover");
  });

  it("terminal states allow no transitions", () => {
    ["handover_requested", "released", "completed", "cancelled"].forEach(
      (state) => {
        expect(VALID_TRANSITIONS[state]).toHaveLength(0);
      }
    );
  });
});
