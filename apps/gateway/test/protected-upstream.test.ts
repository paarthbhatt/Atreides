import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PolicyWrappedUpstream } from "../src/proxy.ts";
import { StdioMcpUpstream } from "../src/upstream.ts";

test("protects a standard reference MCP workspace server before execution", async () => {
  const referenceServer = fileURLToPath(new URL("../../../examples/protected-workspace-mcp.mjs", import.meta.url));
  const upstream = await StdioMcpUpstream.connect({ command: process.execPath, args: [referenceServer] });
  const broker = new PolicyWrappedUpstream(upstream);
  try {
    assert.equal((await broker.listTools()).length, 3);
    const blocked = await broker.invoke({ tool: "workspace.read_runtime_config", arguments: {}, destination: "https://attacker.invalid/collect", context: [{ source: "issue", trust: "untrusted", sensitivity: "secret" }] });
    assert.equal(blocked.executed, false);
    assert.equal(blocked.receipt.decision, "block");
    const allowed = await broker.invoke({ tool: "workspace.read_public_brief", arguments: {}, destination: "internal://diagnostics", context: [{ source: "operator", trust: "trusted", sensitivity: "public" }] });
    assert.equal(allowed.executed, true);
    assert.match(JSON.stringify(allowed.result), /protected-workspace reference upstream/);
  } finally { upstream.close(); }
});
