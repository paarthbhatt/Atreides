import { evaluate, reject, type Action, type Receipt } from "./index.js";
import { validateAgainstSchema } from "./schema.js";
import type { UpstreamTool, UpstreamToolClient } from "./upstream.js";

export type ProxiedInvocation = { tool: string; arguments: Record<string, unknown>; destination?: string; writes?: boolean; context: Action["context"]; actor?: Action["actor"] };
export type ProxiedResult = { receipt: Receipt; executed: boolean; result?: unknown };

// Extract the destination a tool would actually act on from its arguments, so
// the policy decision cannot be made against a different destination than the
// one executed (F3).
function argumentDestination(arguments_: Record<string, unknown>): string | undefined {
  const value = arguments_.destination;
  return typeof value === "string" ? value : undefined;
}

export class PolicyWrappedUpstream {
  constructor(private readonly upstream: UpstreamToolClient) {}
  listTools(): Promise<UpstreamTool[]> { return this.upstream.listTools(); }

  async invoke(invocation: ProxiedInvocation): Promise<ProxiedResult> {
    const tools = await this.upstream.listTools();
    const tool = tools.find((candidate) => candidate.name === invocation.tool);
    if (!tool) throw new Error(`Upstream tool '${invocation.tool}' was not discovered.`);

    const baseAction: Action = { tool: invocation.tool, context: invocation.context, actor: invocation.actor };

    // F2: enforce the discovered input schema before policy or execution.
    const schemaError = validateAgainstSchema(invocation.arguments, tool.inputSchema);
    if (schemaError) {
      return { receipt: reject(baseAction, "atreides/schema-violation", `Arguments failed the discovered input schema: ${schemaError}.`), executed: false };
    }

    // F3: reconcile the executable destination with the declared envelope
    // destination. A disagreement is a smuggling attempt and fails closed; when
    // only the arguments carry a destination, it is the one policy must see.
    const argDest = argumentDestination(invocation.arguments);
    const envDest = invocation.destination;
    if (argDest !== undefined && envDest !== undefined && argDest !== envDest) {
      return { receipt: reject(baseAction, "atreides/conflicting-destination", "The argument destination disagrees with the declared destination."), executed: false };
    }
    const destination = argDest ?? envDest;

    // F4: impact is monotonic. A caller-supplied writes=false can never lower a
    // discovered destructive annotation.
    const writes = Boolean(invocation.writes) || Boolean(tool.annotations?.destructiveHint);

    const receipt = evaluate({ ...baseAction, destination, writes });
    if (receipt.decision !== "allow") return { receipt, executed: false };
    return { receipt, executed: true, result: await this.upstream.callTool(invocation.tool, invocation.arguments) };
  }
}
