import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { StdioMcpUpstream } from "../src/upstream.ts";

test("discovers and calls a real stdio MCP upstream", async () => {
  const fixture = fileURLToPath(new URL("./fixtures/upstream.mjs", import.meta.url));
  const upstream = await StdioMcpUpstream.connect({ command: process.execPath, args: [fixture] });
  try {
    assert.deepEqual((await upstream.listTools()).map((tool) => tool.name), ["fixture.echo"]);
    assert.deepEqual(await upstream.callTool("fixture.echo", { message: "safe" }), { content: [{ type: "text", text: JSON.stringify({ name: "fixture.echo", arguments: { message: "safe" } }) }] });
  } finally { upstream.close(); }
});
