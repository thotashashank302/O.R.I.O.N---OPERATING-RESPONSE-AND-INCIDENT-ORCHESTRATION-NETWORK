import { describe, expect, it } from "vitest";
import { SpecialistAgent, type SpecialistContext } from "@/server/agents/specialist";
import type { FeatherlessProvider } from "@/server/agents/provider";

const ids = {
  run: "00000000-0000-4000-8000-000000000001",
  institution: "00000000-0000-4000-8000-000000000002",
  incident: "00000000-0000-4000-8000-000000000003",
  task: "00000000-0000-4000-8000-000000000004",
  staff: "00000000-0000-4000-8000-000000000005",
};

function context(overrides: Partial<SpecialistContext> = {}): SpecialistContext {
  return {
    task: { id: ids.task, profile: "electrical", goal: "Inspect the affected circuit", evidencePolicy: ["meter reading"], requiresApproval: false },
    severity: "high",
    eligibleStaff: [{ membershipId: ids.staff, skills: ["electrical"], availability: "available", activeAssignments: 0, workloadLimit: 1, capabilityVersion: 2 }],
    ...overrides,
  };
}

function provider(result: Record<string, unknown>) {
  return { run: async () => ({ agent: "specialist", result, provider: "featherless", model: "fixture", latencyMs: 2, repaired: false }) } as unknown as FeatherlessProvider;
}

describe("SpecialistAgent", () => {
  it("accepts a bounded eligible assignment", async () => {
    const agent = new SpecialistAgent(provider({ taskId: ids.task, candidateStaffId: ids.staff, checklist: ["Isolate power"], evidenceRequired: ["meter reading"], communicationType: "assignment" }));
    const output = await agent.execute({ runId: ids.run, institutionId: ids.institution, incidentId: ids.incident, incidentVersion: 1, promptVersion: "test", context: context() });
    expect(output.result.candidateStaffId).toBe(ids.staff);
  });

  it("rejects staff outside the supplied eligible set", async () => {
    const agent = new SpecialistAgent(provider({ taskId: ids.task, candidateStaffId: ids.run, checklist: ["Inspect"], evidenceRequired: ["photo"], communicationType: "assignment" }));
    await expect(agent.execute({ runId: ids.run, institutionId: ids.institution, incidentId: ids.incident, incidentVersion: 1, promptVersion: "test", context: context() })).rejects.toThrow("outside the eligible set");
  });

  it("cannot bypass a required approval", async () => {
    const agent = new SpecialistAgent(provider({ taskId: ids.task, candidateStaffId: ids.staff, checklist: ["Inspect"], evidenceRequired: ["meter reading"], communicationType: "assignment" }));
    await expect(agent.execute({ runId: ids.run, institutionId: ids.institution, incidentId: ids.incident, incidentVersion: 1, promptVersion: "test", context: context({ task: { ...context().task, requiresApproval: true } }) })).rejects.toThrow("bypassed");
  });

  it("cannot weaken the Commander evidence policy", async () => {
    const agent = new SpecialistAgent(provider({ taskId: ids.task, candidateStaffId: ids.staff, checklist: ["Inspect"], evidenceRequired: ["photo"], communicationType: "assignment" }));
    await expect(agent.execute({ runId: ids.run, institutionId: ids.institution, incidentId: ids.incident, incidentVersion: 1, promptVersion: "test", context: context() })).rejects.toThrow("weakened");
  });
});
