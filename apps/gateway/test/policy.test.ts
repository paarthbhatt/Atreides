import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, indirectInjectionFixture } from "../src/index.ts";

test("blocks indirect injection attempting secret egress", () => {
  const receipt = evaluate(indirectInjectionFixture);
  assert.equal(receipt.decision, "block");
  assert.equal(receipt.policy, "atreides/no-untrusted-secret-egress");
  assert.match(receipt.hash, /^[a-f0-9]{64}$/);
});
