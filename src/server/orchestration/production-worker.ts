import { randomUUID } from "node:crypto";
import { z } from "zod";
import { commanderContextSchema } from "./schemas";
import { incidentPlanSchema } from "@/contracts/agents";
import { CommanderAgent } from "@/server/agents/commander";
import { FeatherlessProvider } from "@/server/agents/provider";
import { executeRecorded, type AgentRunStore } from "@/server/agents/runner";
import { SpecialistAgent, specialistContextSchema } from "@/server/agents/specialist";
import { createSupabaseAdmin } from "@/server/db/supabase-admin";
import { deliverOutbox, parseRecipientAllowlist } from "@/server/email/outbox";
import { ResendEmailTransport } from "@/server/email/resend-transport";
import { getEmailDeliveryEnv, getServerEnv } from "@/server/env";
import { DurableJobWorker, type JobRecord } from "./jobs";
import { SupabaseJobStore } from "./supabase-job-store";

export function createProductionWorker(): DurableJobWorker {
  const env = getServerEnv();
  const client = createSupabaseAdmin();
  const provider = new FeatherlessProvider({
    apiKey: env.FEATHERLESS_API_KEY,
    baseUrl: env.FEATHERLESS_BASE_URL,
    model: env.FEATHERLESS_MODEL,
  });
  const commander = new CommanderAgent(provider);
  const specialist = new SpecialistAgent(provider);
  const runStore: AgentRunStore = {
    async save(record) {
      const { error } = await client.from("agent_runs").insert({
        id: record.runId,
        incident_id: record.incidentId,
        institution_id: record.institutionId,
        agent_name: record.agent,
        provider: record.provider,
        model: record.model,
        prompt_version: record.promptVersion,
        latency_ms: record.latencyMs,
        status: record.status,
        validated_outcome: record.validatedOutcome,
        safe_error: record.safeError,
      });
      if (error) throw error;
    },
  };

  const handleCommander = async (job: JobRecord) => {
    if (!job.incidentId) throw new Error("Commander job requires an incident");
    const context = commanderContextSchema.parse(job.payload);
    const runId = randomUUID();
    const output = await executeRecorded(commander, {
      runId,
      institutionId: job.institutionId,
      incidentId: job.incidentId,
      incidentVersion: context.incident.version,
      promptVersion: "commander-v1",
      context,
    }, runStore);
    const plan = incidentPlanSchema.parse(output.result);
    const { error } = await client.rpc("persist_commander_plan", {
      job_id: job.id,
      expected_incident_version: context.incident.version,
      plan_payload: plan,
      agent_run_id: runId,
    });
    if (error) throw error;
  };

  const handleSpecialist = async (job: JobRecord) => {
    if (!job.incidentId) throw new Error("Specialist job requires an incident");
    const { data, error } = await client.rpc("get_specialist_context", { job_id: job.id });
    if (error) throw error;
    const envelope = specialistContextSchema.extend({ incidentVersion: z.number().int().positive() }).parse(data);
    const { incidentVersion, ...context } = envelope;
    const runId = randomUUID();
    const output = await executeRecorded(specialist, {
      runId,
      institutionId: job.institutionId,
      incidentId: job.incidentId,
      incidentVersion,
      promptVersion: "specialist-v1",
      context,
    }, runStore);
    const selected = context.eligibleStaff.find((staff) => staff.membershipId === output.result.candidateStaffId);
    if (!selected) throw new Error("Selected staff context disappeared");
    const persisted = await client.rpc("persist_specialist_action", {
      job_id: job.id,
      expected_incident_version: incidentVersion,
      expected_staff_version: selected.capabilityVersion,
      action_payload: output.result,
      agent_run_id: runId,
    });
    if (persisted.error) throw persisted.error;
  };

  const handleOutbox = async (job: JobRecord) => {
    const emailEnv = getEmailDeliveryEnv();
    await deliverOutbox(job.payload, client, new ResendEmailTransport(emailEnv.RESEND_API_KEY, emailEnv.RESEND_FROM), {
      appUrl: emailEnv.APP_URL,
      actionSecret: emailEnv.EMAIL_ACTION_SECRET,
      demoMode: emailEnv.DEMO_MODE === "true",
      recipientAllowlist: parseRecipientAllowlist(emailEnv.DEMO_RECIPIENT_ALLOWLIST),
    });
  };

  return new DurableJobWorker(new SupabaseJobStore(client), {
    commander: handleCommander,
    specialist: handleSpecialist,
    outbox_delivery: handleOutbox,
  });
}
