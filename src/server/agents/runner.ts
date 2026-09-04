import type { AgentInput, AgentModule, AgentOutput } from "@/contracts/agents";

export interface AgentRunRecord {
  runId: string;
  incidentId: string;
  institutionId: string;
  agent: string;
  provider: string;
  model: string;
  promptVersion: string;
  latencyMs: number;
  status: "succeeded" | "failed";
  validatedOutcome: unknown | null;
  safeError: string | null;
}

export interface AgentRunStore {
  save(record: AgentRunRecord): Promise<void>;
}

/** Persists validated outcomes and operational metadata, never prompts or hidden reasoning. */
export async function executeRecorded<TContext, TResult>(
  module: AgentModule<TContext, TResult>,
  input: AgentInput<TContext>,
  store: AgentRunStore,
): Promise<AgentOutput<TResult>> {
  try {
    const output = await module.execute(input);
    await store.save({
      runId: input.runId,
      incidentId: input.incidentId,
      institutionId: input.institutionId,
      agent: output.agent,
      provider: output.provider,
      model: output.model,
      promptVersion: input.promptVersion,
      latencyMs: output.latencyMs,
      status: "succeeded",
      validatedOutcome: output.result,
      safeError: null,
    });
    return output;
  } catch (error) {
    await store.save({
      runId: input.runId,
      incidentId: input.incidentId,
      institutionId: input.institutionId,
      agent: module.name,
      provider: "featherless",
      model: "configured-at-runtime",
      promptVersion: input.promptVersion,
      latencyMs: 0,
      status: "failed",
      validatedOutcome: null,
      safeError: error instanceof Error ? error.message.slice(0, 300) : "Unknown agent failure",
    });
    throw error;
  }
}
