import { describe, expect, it } from "vitest";
import type { IncidentPlan, PlanTask } from "@/contracts/agents";
import { AgentToolRunner } from "@/server/agents/tool-runner";
import { isMateriallyChanged } from "@/server/agents/commander";
import { DurableJobWorker, type JobRecord, type JobStore } from "@/server/orchestration/jobs";
import { validateTaskGraph } from "@/server/orchestration/dependencies";
import { cancellationDecision, canReopen, duplicateLinkDecision } from "@/server/orchestration/lifecycle";
import { planCarryForward } from "@/server/orchestration/replanning";

const task = (overrides: Partial<PlanTask> = {}): PlanTask => ({
  localId: "isolate", logicalTaskKey: "isolate-power", profile: "electrical", goal: "Isolate electrical risk",
  dependsOn: [], evidencePolicy: ["isolation_test"], requiresApproval: true, ...overrides,
});

describe("orchestration safeguards", () => {
  it("rejects dependency cycles", () => {
    expect(() => validateTaskGraph([task({ localId: "a", dependsOn: ["b"] }), task({ localId: "b", logicalTaskKey: "repair", dependsOn: ["a"] })])).toThrow(/cycle/);
  });

  it("rejects a tool outside the agent allowlist", async () => {
    const runner = new AgentToolRunner({ assignTask: async () => ({ ok: true }) });
    await expect(runner.execute("triage", { name: "assignTask", arguments: {} }, { institutionId: "i", incidentId: "x", runId: "r" })).rejects.toThrow(/not authorized/);
  });

  it("requires a materially changed replan", () => {
    const prior: IncidentPlan = { priority: "high", explanation: "first", specialists: ["electrical"], tasks: [task()], acknowledgementMinutes: 10 };
    expect(isMateriallyChanged(prior, { ...prior, explanation: "rewritten only" })).toBe(false);
    expect(isMateriallyChanged(prior, { ...prior, tasks: [task({ profile: "facilities" })] })).toBe(true);
  });

  it("enforces duplicate, cancellation and reopening boundaries", () => {
    expect(duplicateLinkDecision({ sameInstitution: true, sameScope: true, confidential: false, wouldCycle: false, eitherHasActiveWork: true })).toBe("reconcile");
    expect(duplicateLinkDecision({ sameInstitution: true, sameScope: true, confidential: true, wouldCycle: false, eitherHasActiveWork: false })).toBe("deny");
    expect(cancellationDecision({ visibility: "routine", reporterOwnsIncident: true, hasActiveAssignment: false, hasDependentLinkedReports: false })).toBe("allow");
    expect(canReopen(new Date("2026-09-03T12:00:00Z"), new Date("2026-09-04T11:00:00Z"))).toBe(true);
    expect(canReopen(new Date("2026-09-03T10:00:00Z"), new Date("2026-09-04T11:00:00Z"))).toBe(false);
  });

  it("carries verified work only when its stable identity and evidence are unchanged", () => {
    const decisions = planCarryForward([{ id: "old", logicalTaskKey: "isolate-power", goal: "Isolate electrical risk", locationId: null, evidencePolicy: ["isolation_test"], evidenceVersion: 1, verified: true, hasActiveAssignment: false }], [task()]);
    expect(decisions[0]).toMatchObject({ carriedFromTaskId: "old", carriesVerification: true });
    const changed = planCarryForward([{ id: "old", logicalTaskKey: "isolate-power", goal: "Isolate electrical risk", locationId: null, evidencePolicy: ["isolation_test"], evidenceVersion: 1, verified: true, hasActiveAssignment: true }], [task({ evidencePolicy: ["qualified_inspection"] })]);
    expect(changed[0]).toMatchObject({ carriesVerification: false, requiresAssignmentReconciliation: true });
  });
});

class MemoryStore implements JobStore {
  jobs: JobRecord[];
  succeeded = 0;
  retried = 0;
  deadCount = 0;
  notified = 0;
  constructor(attempt: number) {
    this.jobs = [{ id: "j", type: "commander", incidentId: "i", institutionId: "t", status: "queued", attempt, dueAt: new Date(), leaseUntil: null, payload: {} }];
  }
  async claim() { return this.jobs.splice(0); }
  async succeed() { this.succeeded += 1; }
  async retry() { this.retried += 1; }
  async dead() { this.deadCount += 1; }
  async notifySupervisor() { this.notified += 1; }
}

describe("durable worker", () => {
  it("marks a claimed job successful", async () => {
    const store = new MemoryStore(1);
    const result = await new DurableJobWorker(store, { commander: async () => undefined }).tick("w");
    expect(result).toMatchObject({ claimed: 1, succeeded: 1, retried: 0, dead: 0 });
  });

  it("retries bounded failures then escalates the final attempt", async () => {
    const retryStore = new MemoryStore(1);
    await new DurableJobWorker(retryStore, { commander: async () => { throw new Error("provider down"); } }).tick("w");
    expect(retryStore.retried).toBe(1);
    const deadStore = new MemoryStore(3);
    await new DurableJobWorker(deadStore, { commander: async () => { throw new Error("provider down"); } }).tick("w");
    expect(deadStore.deadCount).toBe(1);
    expect(deadStore.notified).toBe(1);
  });
});
