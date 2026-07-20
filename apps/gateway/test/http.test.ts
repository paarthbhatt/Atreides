import assert from "node:assert/strict";
import test from "node:test";
import { server } from "../src/index.ts";

test("serves health, evaluates the safe attack fixture, and exposes its receipt", async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json() as { status: string }).status, "ok");

    const replay = await fetch(`${baseUrl}/v1/demo/indirect-prompt-injection`, { method: "POST" });
    assert.equal(replay.status, 200);
    const receipt = (await replay.json() as { receipt: { id: string; decision: string; hash: string } }).receipt;
    assert.equal(receipt.decision, "block");
    assert.match(receipt.hash, /^[a-f0-9]{64}$/);

    const ledger = await fetch(`${baseUrl}/v1/receipts`);
    assert.equal(ledger.status, 200);
    const body = await ledger.json() as { receipts: Array<{ id: string }> };
    assert.ok(body.receipts.some((item) => item.id === receipt.id));

    const previousToken = process.env.ATREIDES_API_TOKEN;
    process.env.ATREIDES_API_TOKEN = "test-token";
    try {
      assert.equal((await fetch(`${baseUrl}/v1/evaluate`, { method: "POST", body: JSON.stringify({ tool: "workspace.readme", context: [] }) })).status, 401);
      assert.equal((await fetch(`${baseUrl}/v1/evaluate`, { method: "POST", headers: { authorization: "Bearer test-token" }, body: JSON.stringify({ tool: "workspace.readme", context: [] }) })).status, 200);
    } finally {
      if (previousToken === undefined) delete process.env.ATREIDES_API_TOKEN;
      else process.env.ATREIDES_API_TOKEN = previousToken;
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
