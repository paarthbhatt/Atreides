import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { evaluate, type Action } from "./index.js";
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

await atreides.connect(new StdioServerTransport());
