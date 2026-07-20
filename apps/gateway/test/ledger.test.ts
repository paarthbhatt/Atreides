import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ReceiptLedger, hashReceipt } from "../src/ledger.ts";
import type { Receipt } from "../src/index.ts";

test("persists, signs, and verifies a receipt chain", () => {
  const directory = mkdtempSync(join(tmpdir(), "atreides-ledger-"));
  try {
    const ledger = new ReceiptLedger({ path: join(directory, "receipts.jsonl"), signingKey: "test-key", signingKeyId: "test" });
    const base = { id: "r-1", timestamp: "2026-07-21T00:00:00.000Z", decision: "allow" as const, reason: "safe", policy: "atreides/default-allow", policyVersion: "test", action: { tool: "workspace.readme", context: [] }, previousHash: null };
    const hash = hashReceipt({ ...base, hash: "" } as Receipt);
    const receipt: Receipt = { ...base, hash, signature: ledger.sign(hash) };
    ledger.append(receipt);
    assert.deepEqual(ledger.verify(), { valid: true, receipts: 1, failures: [] });
    assert.equal(new ReceiptLedger({ path: join(directory, "receipts.jsonl"), signingKey: "test-key" }).verify().valid, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
