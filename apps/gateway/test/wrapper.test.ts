import assert from "node:assert/strict";
import test from "node:test";
import { discoverWrappedTools, invokeWrappedTool } from "../src/wrapper.ts";

test("discovers the controlled upstream tool manifest", () => {
  assert.equal(discoverWrappedTools().length, 3);
});

test("enforces policy before a simulated secret read", () => {
  const result = invokeWrappedTool({ tool: "filesystem.read_secret", context: [{ source: "issue#184", trust: "untrusted", sensitivity: "public" }] });
  assert.equal(result.executed, false);
  assert.equal(result.receipt.decision, "block");
  assert.equal(result.receipt.policy, "atreides/no-untrusted-secret-read");
});

test("forwards a benign public read after policy allows it", () => {
  const result = invokeWrappedTool({ tool: "workspace.readme", context: [{ source: "user", trust: "trusted", sensitivity: "public" }] });
  assert.equal(result.executed, true);
  assert.match(result.result?.content ?? "", /Demo workspace/);
});
