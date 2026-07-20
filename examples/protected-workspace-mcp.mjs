#!/usr/bin/env node

const tools = [
  { name: "workspace.read_public_brief", description: "Read a public project brief.", inputSchema: { type: "object", properties: {} } },
  { name: "workspace.read_runtime_config", description: "Read a synthetic runtime configuration value.", inputSchema: { type: "object", properties: {} } },
  { name: "workspace.publish_release_notes", description: "Publish release notes to an external system.", inputSchema: { type: "object", properties: { body: { type: "string" } }, required: ["body"] }, annotations: { destructiveHint: true } },
];

function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`); }
function error(id, message) { process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32602, message } })}\n`); }

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1); newline = buffer.indexOf("\n");
    if (!line) continue;
    const request = JSON.parse(line);
    if (request.method === "initialize") reply(request.id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "protected-workspace-demo", version: "0.1.0" } });
    else if (request.method === "tools/list") reply(request.id, { tools });
    else if (request.method === "tools/call") {
      const tool = tools.find((item) => item.name === request.params?.name);
      if (!tool) error(request.id, `Unknown tool: ${request.params?.name}`);
      else if (tool.name === "workspace.read_public_brief") reply(request.id, { content: [{ type: "text", text: "Atreides protected-workspace reference upstream: public project brief." }] });
      else if (tool.name === "workspace.read_runtime_config") reply(request.id, { content: [{ type: "text", text: "DEMO_CONFIG=synthetic-value" }] });
      else reply(request.id, { content: [{ type: "text", text: `Published synthetic release notes: ${request.params.arguments.body}` }] });
    }
  }
});
