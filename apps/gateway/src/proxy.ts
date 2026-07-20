import { evaluate, type Action, type Receipt } from "./index.js";
import type { UpstreamTool, UpstreamToolClient } from "./upstream.js";

export type ProxiedInvocation = { tool: string; arguments: Record<string, unknown>; destination?: string; writes?: boolean; context: Action["context"] };
export type ProxiedResult = { receipt: Receipt; executed: boolean; result?: unknown };

export class PolicyWrappedUpstream {
  constructor(private readonly upstream: UpstreamToolClient) {}
  listTools(): Promise<UpstreamTool[]> { return this.upstream.listTools(); }

  async invoke(invocation: ProxiedInvocation): Promise<ProxiedResult> {
    const tools = await this.upstream.listTools();
    const tool = tools.find((candidate) => candidate.name === invocation.tool);
    if (!tool) throw new Error(`Upstream tool '${invocation.tool}' was not discovered.`);
    const receipt = evaluate({ tool: invocation.tool, destination: invocation.destination, writes: invocation.writes ?? Boolean(tool.annotations?.destructiveHint), context: invocation.context });
    if (receipt.decision !== "allow") return { receipt, executed: false };
    return { receipt, executed: true, result: await this.upstream.callTool(invocation.tool, invocation.arguments) };
  }
}
