import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { currentPolicy, evaluate, listReceipts, type Action } from "./index.js";
import { PolicyWrappedUpstream } from "./proxy.js";
import { connectConfiguredUpstream } from "./upstream.js";
import { discoverWrappedTools, invokeWrappedTool } from "./wrapper.js";

const atreides = new McpServer({ name: "atreides", version: "0.1.0" });

atreides.registerTool(
  "evaluate_agent_action",
  {
    title: "Evaluate an agent action with provenance-aware policy",
    description: "Returns an Atreides trust receipt. Use before a tool action crosses a sensitive boundary.",
    inputSchema: z.object({
      tool: z.string(),
      destination: z.string().optional(),
      writes: z.boolean().optional(),
      context: z.array(z.object({
        source: z.string(), trust: z.enum(["trusted", "external", "untrusted"]),
        sensitivity: z.enum(["public", "internal", "confidential", "secret"]), contentHash: z.string().optional()
      }))
    })
  },
  async (input) => ({ content: [{ type: "text", text: JSON.stringify(evaluate(input as Action), null, 2) }] })
);

atreides.registerTool(
  "invoke_atreides_wrapped_tool",
  {
    title: "Invoke a policy-wrapped demo MCP tool",
    description: "Discovers and invokes a controlled upstream tool only after Atreides evaluates its provenance-aware policy.",
    inputSchema: z.object({
      tool: z.enum(discoverWrappedTools().map((tool) => tool.name) as ["workspace.readme", "filesystem.read_secret", "diagnostics.send"]),
      destination: z.string().optional(),
      context: z.array(z.object({
        source: z.string(), trust: z.enum(["trusted", "external", "untrusted"]),
        sensitivity: z.enum(["public", "internal", "confidential", "secret"]), contentHash: z.string().optional()
      }))
    })
  },
  async (input) => ({ content: [{ type: "text", text: JSON.stringify(invokeWrappedTool(input), null, 2) }] })
);

atreides.registerTool(
  "get_atreides_policy",
  {
    title: "Read the active Atreides policy bundle",
    description: "Returns the versioned policy-as-code bundle currently used for enforcement.",
    inputSchema: z.object({}),
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify({ policy: currentPolicy(), receipts: listReceipts().length }, null, 2) }] })
);

const configuredUpstream = await connectConfiguredUpstream();
if (configuredUpstream) {
  const upstream = new PolicyWrappedUpstream(configuredUpstream);
  atreides.registerTool(
    "list_atreides_upstream_tools",
    {
      title: "Discover tools exposed by the configured upstream MCP server",
      description: "Lists upstream tools that can be invoked only through Atreides policy evaluation.",
      inputSchema: z.object({}),
    },
    async () => ({ content: [{ type: "text", text: JSON.stringify(await upstream.listTools(), null, 2) }] })
  );
  atreides.registerTool(
    "invoke_atreides_upstream_tool",
    {
      title: "Invoke a configured upstream MCP tool through Atreides",
      description: "Discovers the named upstream tool, evaluates provenance policy before execution, and forwards only allowed calls.",
      inputSchema: z.object({
        tool: z.string(), arguments: z.record(z.string(), z.unknown()).default({}), destination: z.string().optional(), writes: z.boolean().optional(),
        context: z.array(z.object({ source: z.string(), trust: z.enum(["trusted", "external", "untrusted"]), sensitivity: z.enum(["public", "internal", "confidential", "secret"]), contentHash: z.string().optional() })),
      }),
    },
    async (input) => ({ content: [{ type: "text", text: JSON.stringify(await upstream.invoke(input), null, 2) }] })
  );
}

await atreides.connect(new StdioServerTransport());
