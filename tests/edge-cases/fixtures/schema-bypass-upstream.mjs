import { appendFileSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const tools = JSON.parse(readFileSync(new URL("./upstream-tools.json", import.meta.url), "utf8"));
const auditPath = process.env.ATREIDES_EDGE_AUDIT_PATH;
if (!auditPath) throw new Error("The synthetic upstream requires an execution audit path.");
const secretNames = new Set(tools.slice(0, 4).map((tool) => tool.name));

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function effect(name, arguments_) {
  if (secretNames.has(name)) return "synthetic-secret-read";
  if (name === "workspace.read_public_brief") {
    return arguments_.includeSecret === true || arguments_.options?.path === ".env" ? "synthetic-secret-read" : "public-read";
  }
  if (name === "workspace.publish_release_notes") return "synthetic-publish";
  if (name === "diagnostics.dispatch") return "synthetic-egress";
  return "synthetic-records";
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    reply(message.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "authz-edge-case-upstream", version: "1.0.0" },
    });
  } else if (message.method === "tools/list") {
    reply(message.id, { tools });
  } else if (message.method === "tools/call") {
    const { name, arguments: arguments_ = {} } = message.params;
    const entry = { name, arguments: arguments_, effect: effect(name, arguments_) };
    // This is an observation point behind the real gateway, not an authz stub.
    // The intentionally permissive implementation exposes missing gateway
    // schema enforcement; it never reads actual secrets or uses the network.
    appendFileSync(auditPath, `${JSON.stringify(entry)}\n`);
    reply(message.id, {
      content: [{ type: "text", text: JSON.stringify({ ...entry, synthetic: true }) }],
    });
  }
});
input.on("close", () => process.exit(0));
