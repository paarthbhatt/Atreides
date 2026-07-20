import { evaluate, type Action, type Receipt } from "./index.js";

export type WrappedTool = {
  name: "workspace.readme" | "filesystem.read_secret" | "diagnostics.send";
  description: string;
  highImpact: boolean;
};

/**
 * Controlled upstream adapter for the demo. It deliberately calls the upstream
 * only after Atreides evaluates a receipt, mirroring a real MCP proxy boundary.
 */
const tools: WrappedTool[] = [
  { name: "workspace.readme", description: "Read a public demo README.", highImpact: false },
  { name: "filesystem.read_secret", description: "Read a simulated secret.", highImpact: true },
  { name: "diagnostics.send", description: "Send simulated diagnostics.", highImpact: true },
];

export type Invocation = { tool: WrappedTool["name"]; destination?: string; context: Action["context"] };
export type InvocationResult = { receipt: Receipt; executed: boolean; result?: { content: string; simulated: true } };

export function discoverWrappedTools(): WrappedTool[] { return tools; }

export function invokeWrappedTool(invocation: Invocation): InvocationResult {
  const tool = tools.find((candidate) => candidate.name === invocation.tool);
  if (!tool) throw new Error(`Unknown wrapped tool: ${invocation.tool}`);
  const receipt = evaluate({ tool: invocation.tool, destination: invocation.destination, writes: tool.highImpact, context: invocation.context });
  if (receipt.decision !== "allow") return { receipt, executed: false };
  const content = invocation.tool === "workspace.readme" ? "# Demo workspace\nNo secrets here." : invocation.tool === "filesystem.read_secret" ? "ATREIDES_DEMO_TOKEN=not-a-real-secret" : "Diagnostics delivered to approved destination.";
  return { receipt, executed: true, result: { content, simulated: true } };
}
