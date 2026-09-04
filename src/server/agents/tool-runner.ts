import type { AgentName } from "@/contracts/agents";
import { AGENT_TOOL_ALLOWLIST, toolCallSchema, type ToolCall, type ToolName } from "@/contracts/tools";

export interface ToolExecutionContext {
  institutionId: string;
  incidentId: string;
  runId: string;
}

export type ToolHandler = (arguments_: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown>;

export class AgentToolRunner {
  constructor(private readonly handlers: Partial<Record<ToolName, ToolHandler>>) {}

  async execute(agent: AgentName, rawCall: unknown, context: ToolExecutionContext): Promise<unknown> {
    const call: ToolCall = toolCallSchema.parse(rawCall);
    if (!AGENT_TOOL_ALLOWLIST[agent]?.includes(call.name)) {
      throw new Error(`Tool ${call.name} is not authorized for ${agent}`);
    }
    const handler = this.handlers[call.name];
    if (!handler) throw new Error(`Tool ${call.name} is not configured`);
    return handler(call.arguments, context);
  }
}
