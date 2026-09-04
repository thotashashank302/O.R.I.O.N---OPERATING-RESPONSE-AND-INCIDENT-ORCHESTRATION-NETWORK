import { z } from "zod";
import type { AgentName, AgentOutput } from "@/contracts/agents";

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export interface ProviderRequest<TResult> {
  agent: AgentName;
  system: string;
  userData: unknown;
  schema: z.ZodType<TResult>;
  signal?: AbortSignal;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class ProviderError extends Error {
  constructor(message: string, public readonly retryable: boolean) {
    super(message);
    this.name = "ProviderError";
  }
}

export class FeatherlessProvider {
  private readonly timeoutMs: number;
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: ProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetcher = config.fetch ?? fetch;
  }

  async run<TResult>(request: ProviderRequest<TResult>): Promise<AgentOutput<TResult>> {
    const started = performance.now();
    const first = await this.complete(request, false);
    const parsed = this.parse(first, request.schema);
    if (parsed.success) return this.output(request.agent, parsed.data, started, false);

    const repaired = await this.complete({
      ...request,
      system: `${request.system}\nReturn only valid JSON matching the requested shape. Repair the prior invalid response.`,
      userData: { originalInput: request.userData, invalidResponse: first },
    }, true);
    const validated = this.parse(repaired, request.schema);
    if (!validated.success) throw new ProviderError("Provider returned invalid structured output after one repair", false);
    return this.output(request.agent, validated.data, started, true);
  }

  private async complete<TResult>(request: ProviderRequest<TResult>, repair: boolean): Promise<string> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.1,
          messages: [
            { role: "system", content: `${request.system}\nYour response must match this JSON Schema exactly:\n${JSON.stringify(z.toJSONSchema(request.schema))}` },
            { role: "user", content: JSON.stringify({ kind: repair ? "repair_data" : "untrusted_incident_data", data: request.userData }) },
          ],
        }),
        signal,
      });
    } catch (error) {
      throw new ProviderError(error instanceof Error ? error.message : "Provider request failed", true);
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(`Provider request failed with status ${response.status}`, retryable);
    }
    const payload = completionSchema.safeParse(await response.json());
    if (!payload.success) throw new ProviderError("Provider response envelope was invalid", false);
    return payload.data.choices[0].message.content;
  }

  private parse<TResult>(content: string, schema: z.ZodType<TResult>) {
    try {
      const normalized = content.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      return schema.safeParse(JSON.parse(normalized));
    } catch {
      return { success: false as const };
    }
  }

  private output<TResult>(agent: AgentName, result: TResult, started: number, repaired: boolean): AgentOutput<TResult> {
    return {
      agent,
      result,
      provider: "featherless",
      model: this.config.model,
      latencyMs: Math.round(performance.now() - started),
      repaired,
    };
  }
}
