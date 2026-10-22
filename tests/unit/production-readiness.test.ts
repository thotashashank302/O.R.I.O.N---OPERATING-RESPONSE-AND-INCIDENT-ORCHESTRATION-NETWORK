import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), send: vi.fn() }));
vi.mock("@/server/db/client", () => ({ createServiceClient: async () => ({ rpc: state.rpc, from: state.from }) }));
vi.mock("resend", () => ({ Resend: class { emails = { send: state.send }; } }));
import { performAssignmentAction } from "@/server/operations/assignment-actions";
import { CommanderAgent } from "@/server/agents/commander";
import { assertRecipientAllowed } from "@/server/email/outbox";
import { ResendEmailTransport } from "@/server/email/resend-transport";
import { isAutomationAuthorized } from "@/server/orchestration/automation-auth";
import type { CommanderContext } from "@/server/agents/commander";
import type { FeatherlessProvider } from "@/server/agents/provider";

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("authoritative assignment mutations", () => {
  it.each([{ code: "P0001", message: "Assignment plan is no longer active", status: 409 }, { code: "42501", message: "Inactive membership", status: 403 }, { message: "Connection lost after commit", status: 503 }])("never falls back after $message", async failure => {
    state.rpc.mockResolvedValue({ data: null, error: failure });
    await expect(performAssignmentAction("assignment", "member", { action: "start", expected_version: 1 })).rejects.toMatchObject({ status: failure.status });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.from).not.toHaveBeenCalled();
  });
});

it("forces human approval on a critical electrical plan even if the model omits it", async () => {
  const plan = { priority: "critical", explanation: "Repair exposed wiring", specialists: ["electrician"], acknowledgementMinutes: 10,
    tasks: [{ localId: "fix", logicalTaskKey: "fix", profile: "electrician", goal: "Repair wiring", dependsOn: [], evidencePolicy: ["note", "test_result"], requiresApproval: false }] };
  const provider = { run: async () => ({ result: plan }) } as unknown as FeatherlessProvider;
  const context = { incident: { id: "incident", institutionId: "campus", version: 1, planVersion: 0, description: "Exposed wiring", category: "electrical_safety", locationId: null, visibility: "routine", severityFloor: "critical", state: "triaging", failedReason: null }, eligibleProfiles: ["electrician"], priorPlan: null, failureReason: null } satisfies CommanderContext;
  const output = await new CommanderAgent(provider).execute({ runId: "run", institutionId: "campus", incidentId: "incident", incidentVersion: 1, promptVersion: "test", context });
  expect(output.result.tasks[0].requiresApproval).toBe(true);
});

describe("email destinations", () => {
  it.each([true, false])("rejects a demo mailbox with demo mode %s", demoMode => {
    expect(() => assertRecipientAllowed("staff@orion-demo.edu", { demoMode, recipientAllowlist: new Set(["staff@orion-demo.edu"]) })).toThrow(/Demo addresses/);
  });
  it("does not substitute a personal recipient in the transport", async () => {
    state.send.mockResolvedValue({ data: { id: "message" }, error: null });
    await new ResendEmailTransport("test", "sender@example.invalid").sendAssignment({ recipient: "staff@example.invalid", actionUrl: "https://orion.invalid/action", acknowledgementDeadline: "10:00", urgent: false, idempotencyKey: "test" });
    expect(state.send.mock.calls[0][0].to).toEqual(["staff@example.invalid"]);
  });
});

it("requires a configured strong automation credential", () => {
  vi.stubEnv("AUTOMATION_SECRET", "short"); vi.stubEnv("CRON_SECRET", "");
  expect(isAutomationAuthorized(new Request("http://localhost", { headers: { authorization: "Bearer short" } }))).toBe(false);
  vi.stubEnv("AUTOMATION_SECRET", "x".repeat(32));
  expect(isAutomationAuthorized(new Request("http://localhost", { headers: { authorization: `Bearer ${"x".repeat(32)}` } }))).toBe(true);
  expect(isAutomationAuthorized(new Request("http://localhost"))).toBe(false);
});
