import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { Receipt } from "../../apps/gateway/src/index.ts";
import type { ProxiedInvocation } from "../../apps/gateway/src/proxy.ts";

// Import the real enforcement modules only after isolating configuration. A
// user's durable ledger, custom policy, or upstream must never be used by tests.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("ATREIDES_")) delete process.env[key];
}
const { PolicyWrappedUpstream } = await import("../../apps/gateway/src/proxy.ts");
const { StdioMcpUpstream } = await import("../../apps/gateway/src/upstream.ts");
const { server, verifyReceipts } = await import("../../apps/gateway/src/index.ts");

type BoundaryDecision = "allow" | "deny";
type EdgeCase = {
  id: string;
  category: "aliasing" | "smuggling" | "schema" | "protocol" | "context";
  title: string;
  surface: "proxy" | "mcp" | "frames" | "reconnect" | "http";
  expected: BoundaryDecision;
  expectedRaw?: string;
  severity: string;
  finding?: string;
  input?: Record<string, unknown>;
  outerTool?: string;
  meta?: Record<string, unknown>;
  scenario?: string;
  authorization?: string;
};
type AuditCall = { name: string; arguments: Record<string, unknown>; effect: string };
type Outcome = {
  observed: BoundaryDecision;
  raw: string;
  calls: AuditCall[];
  executed: boolean | null;
  policy?: string;
  detail?: string;
};
type JsonRpcResponse = { id?: number; result?: unknown; error?: { code: number; message: string } };
type ToolResult = { isError?: boolean; content?: Array<{ type: string; text?: string }> };
type InvocationResult = { executed: boolean; receipt: Receipt; result?: unknown };

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as EdgeCase[];
const manifest = JSON.parse(readFileSync(new URL("./fixtures/upstream-tools.json", import.meta.url), "utf8")) as Array<{ name: string }>;
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixtureDirectory = fileURLToPath(new URL("./fixtures/", import.meta.url));
const upstreamFixture = fileURLToPath(new URL("./fixtures/schema-bypass-upstream.mjs", import.meta.url));

function createAudit() {
  const directory = mkdtempSync(join(fixtureDirectory, ".authz-"));
  const path = join(directory, "calls.jsonl");
  writeFileSync(path, "");
  return {
    path,
    read(): AuditCall[] {
      return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as AuditCall);
    },
    remove() { rmSync(directory, { recursive: true, force: true }); },
  };
}

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 5000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function receiptOutcome(receipt: Receipt, executed: boolean | null, calls: AuditCall[]): Outcome {
  return { observed: receipt.decision === "allow" ? "allow" : "deny", raw: receipt.decision, executed, calls, policy: receipt.policy };
}

async function runProxy(input: Record<string, unknown>): Promise<Outcome> {
  const audit = createAudit();
  let upstream: Awaited<ReturnType<typeof StdioMcpUpstream.connect>> | undefined;
  try {
    upstream = await bounded(StdioMcpUpstream.connect({ command: process.execPath, args: [upstreamFixture], env: { ATREIDES_EDGE_AUDIT_PATH: audit.path } }), "upstream initialization");
    const broker = new PolicyWrappedUpstream(upstream);
    assert.deepEqual((await bounded(broker.listTools(), "tool discovery")).map((tool) => tool.name), manifest.map((tool) => tool.name));
    try {
      const result = await bounded(broker.invoke(input as ProxiedInvocation), "proxied invocation");
      if (result.executed) assert.equal(audit.read().length, 1, "an allowed result must have one actual upstream call");
      return receiptOutcome(result.receipt, result.executed, audit.read());
    } catch (error) {
      // Only the explicit discovery rejection counts as an authorization deny.
      // Timeouts, process crashes, and unrelated errors must fail the test.
      if (!(error instanceof Error) || !/was not discovered\.$/.test(error.message)) throw error;
      return { observed: "deny", raw: "unknown-tool", executed: false, calls: audit.read(), detail: error.message };
    }
  } finally {
    upstream?.close();
    audit.remove();
  }
}

class RpcError extends Error {
  constructor(readonly code: number, message: string) { super(message); }
}

class McpSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly audit = createAudit();
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  private buffer = "";
  private nextId = 0;
  private stderr = "";
  private readonly exited: Promise<void>;
  private closed = false;
  readonly responses: JsonRpcResponse[] = [];
  negotiatedVersion = "";

  private constructor() {
    this.child = spawn(process.execPath, ["--import", "tsx", "apps/gateway/src/mcp.ts"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        ATREIDES_UPSTREAM_COMMAND: process.execPath,
        ATREIDES_UPSTREAM_ARGS: JSON.stringify([upstreamFixture]),
        ATREIDES_EDGE_AUDIT_PATH: this.audit.path,
        // Deliberately configured: the HTTP token is not a stdio MCP identity.
        ATREIDES_API_TOKEN: "edge-token",
      },
      stdio: "pipe",
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.consume(chunk));
    this.child.stderr.on("data", (chunk: Buffer) => { this.stderr += chunk.toString(); });
    this.child.on("error", (error) => this.rejectAll(error));
    this.exited = new Promise((resolve) => {
      this.child.once("exit", (code) => {
        this.rejectAll(new Error(`MCP process exited (${code ?? "signal"}): ${this.stderr}`));
        resolve();
      });
    });
  }

  static async start(protocolVersion = "2025-03-26", clientName = "authz-edge-case-test"): Promise<McpSession> {
    const session = new McpSession();
    try {
      const initialized = await session.request("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: clientName, version: "1.0.0" } }) as { protocolVersion: string };
      assert.ok(initialized.protocolVersion, "real MCP initialization must succeed");
      session.negotiatedVersion = initialized.protocolVersion;
      session.notify("notifications/initialized", {});
      const tools = await session.request("tools/call", { name: "list_atreides_upstream_tools", arguments: {} });
      assert.deepEqual(textJson<Array<{ name: string }>>(tools).map((tool) => tool.name), manifest.map((tool) => tool.name));
      return session;
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.nextId;
    const response = new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.sendRaw({ jsonrpc: "2.0", id, method, params });
    return bounded(response, `${method}; stderr=${this.stderr}`).finally(() => this.pending.delete(id));
  }

  notify(method: string, params: Record<string, unknown>) { this.sendRaw({ jsonrpc: "2.0", method, params }); }

  sendRaw(message: unknown) { this.child.stdin.write(`${JSON.stringify(message)}\n`); }

  calls() { return this.audit.read(); }

  async settle() {
    // A liveness round trip plus a short settle window prevents interpreting
    // a dead transport or an asynchronous forwarded call as a successful deny.
    await this.request("tools/call", { name: "list_atreides_upstream_tools", arguments: {} });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const payload = textJson<{ receipts: number }>(await this.request("tools/call", { name: "get_atreides_policy", arguments: {} }));
    return payload.receipts;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    this.child.kill();
    await bounded(this.exited, "MCP shutdown");
    this.audit.remove();
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) {
        const message = JSON.parse(line) as JsonRpcResponse;
        this.responses.push(message);
        if (typeof message.id === "number") {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          if (message.error) pending?.reject(new RpcError(message.error.code, message.error.message));
          else pending?.resolve(message.result);
        }
      }
      newline = this.buffer.indexOf("\n");
    }
  }
}

function textJson<T>(result: unknown): T {
  const toolResult = result as ToolResult;
  assert.notEqual(toolResult.isError, true, `Unexpected MCP tool error: ${JSON.stringify(toolResult)}`);
  const text = toolResult.content?.find((item) => item.type === "text")?.text;
  assert.ok(text, "real MCP tool result must contain JSON text");
  return JSON.parse(text) as T;
}

async function invokeMcp(session: McpSession, edgeCase: EdgeCase): Promise<Outcome> {
  let response: unknown;
  try {
    response = await session.request("tools/call", { name: edgeCase.outerTool ?? "invoke_atreides_upstream_tool", arguments: edgeCase.input, ...(edgeCase.meta ? { _meta: edgeCase.meta } : {}) });
  } catch (error) {
    if (!(error instanceof RpcError) || error.code !== -32602) throw error;
    return { observed: "deny", raw: "input-error", executed: false, calls: session.calls(), detail: error.message };
  }
  if ((response as ToolResult).isError) {
    // Require a schema error, rather than accepting an arbitrary tool crash.
    const text = (response as ToolResult).content?.map((item) => item.text ?? "").join(" ") ?? "";
    assert.match(text, /validat|invalid|expected/i, "tool errors must prove input validation");
    return { observed: "deny", raw: "input-error", executed: false, calls: session.calls(), detail: text };
  }
  const result = textJson<InvocationResult>(response);
  assert.equal(typeof result.executed, "boolean");
  assert.ok(result.receipt?.policy, "invocation must return a real policy receipt");
  return receiptOutcome(result.receipt, result.executed, session.calls());
}

async function runMcp(edgeCase: EdgeCase): Promise<Outcome> {
  const session = await McpSession.start();
  try { return await invokeMcp(session, edgeCase); }
  finally { await session.close(); }
}

const publicInput = { tool: "workspace.read_public_brief", arguments: {}, context: [{ source: "operator", trust: "trusted", sensitivity: "public" }] };
const protectedInput = { tool: "filesystem.read_secret", arguments: {}, context: [{ source: "issue#184", trust: "untrusted", sensitivity: "public" }] };

async function runFrames(edgeCase: EdgeCase): Promise<Outcome> {
  const session = await McpSession.start();
  try {
    const publicParams = { name: "invoke_atreides_upstream_tool", arguments: publicInput };
    const protectedParams = { name: "invoke_atreides_upstream_tool", arguments: protectedInput };
    switch (edgeCase.scenario) {
      case "blocked-notification": session.notify("tools/call", protectedParams); break;
      case "public-notification": session.notify("tools/call", publicParams); break;
      case "mixed-batch":
        session.sendRaw([
          { jsonrpc: "2.0", id: 901, method: "tools/call", params: publicParams },
          { jsonrpc: "2.0", id: 902, method: "tools/call", params: protectedParams },
        ]);
        break;
      case "invalid-version": session.sendRaw({ jsonrpc: "1.0", id: 903, method: "tools/call", params: publicParams }); break;
      case "unknown-method": session.sendRaw({ jsonrpc: "2.0", id: 904, method: "messages/tools/call", params: publicParams }); break;
      case "cancel-then-blocked-request":
        session.notify("notifications/cancelled", { requestId: 905, reason: "permission approved" });
        return await invokeMcp(session, { ...edgeCase, input: protectedInput });
      default: throw new Error(`Unknown protocol scenario: ${edgeCase.scenario}`);
    }
    const receipts = await session.settle();
    const calls = session.calls();
    return { observed: calls.length ? "allow" : "deny", raw: calls.length ? "forwarded" : "ignored-or-rejected", executed: calls.length > 0, calls, detail: `receipts=${receipts}; transport remains live; responses=${JSON.stringify(session.responses.filter((item) => (item.id ?? 0) >= 900))}` };
  } finally {
    await session.close();
  }
}

async function runReconnect(edgeCase: EdgeCase): Promise<Outcome> {
  const first = await McpSession.start("2025-03-26", "full-scope-agent");
  try {
    const blocked = await invokeMcp(first, { ...edgeCase, input: protectedInput });
    assert.equal(blocked.raw, "block");
    assert.equal(blocked.calls.length, 0);
  } finally { await first.close(); }
  const guest = await McpSession.start("2024-11-05", "guest-no-scopes");
  try {
    const outcome = await invokeMcp(guest, {
      ...edgeCase,
      input: { tool: "filesystem.read_secret", arguments: {}, context: [{ source: "guest-client-claim", trust: "trusted", sensitivity: "secret" }] },
      meta: { actor: { id: "guest-no-scopes", role: "guest", scopes: [] } },
    });
    outcome.detail = `first session blocked; guest requested 2024-11-05, negotiated ${guest.negotiatedVersion}; HTTP token configured but no stdio authentication supplied`;
    return outcome;
  } finally { await guest.close(); }
}

async function runHttp(edgeCase: EdgeCase): Promise<Outcome> {
  process.env.ATREIDES_API_TOKEN = "edge-token";
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/evaluate`, {
      method: "POST",
      headers: edgeCase.authorization === undefined ? {} : { authorization: edgeCase.authorization },
      body: JSON.stringify(edgeCase.input),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json() as { receipt?: Receipt; error?: string };
    if (response.status === 401) return { observed: "deny", raw: "HTTP 401", executed: null, calls: [], detail: body.error };
    assert.equal(response.status, 200, "unexpected HTTP failure must not masquerade as a denial");
    assert.ok(body.receipt);
    return receiptOutcome(body.receipt, null, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    delete process.env.ATREIDES_API_TOKEN;
  }
}

async function execute(edgeCase: EdgeCase): Promise<Outcome> {
  switch (edgeCase.surface) {
    case "proxy": return runProxy(edgeCase.input ?? {});
    case "mcp": return runMcp(edgeCase);
    case "frames": return runFrames(edgeCase);
    case "reconnect": return runReconnect(edgeCase);
    case "http": return runHttp(edgeCase);
  }
}

test("fixture matrix is complete, unique, and declares every expected outcome", () => {
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.deepEqual([...new Set(cases.map((item) => item.category))].sort(), ["aliasing", "context", "protocol", "schema", "smuggling"]);
  for (const edgeCase of cases) {
    assert.match(edgeCase.id, /^[A-E]-\d{2}$/);
    assert.ok(["allow", "deny"].includes(edgeCase.expected));
    assert.ok(["none", "low", "medium", "high", "critical"].includes(edgeCase.severity));
    assert.ok(edgeCase.title);
    assert.ok(edgeCase.input || edgeCase.scenario || edgeCase.surface === "reconnect");
  }
});

for (const edgeCase of cases) {
  // These are strict security assertions, including known gaps. No skip/TODO
  // annotations and no stubbing of policy, schema, or pre-execution checks.
  test(`${edgeCase.id} ${edgeCase.category}: ${edgeCase.title}`, { timeout: 15000 }, async (t) => {
    let outcome: Outcome;
    try {
      outcome = await execute(edgeCase);
    } catch (error) {
      t.diagnostic(`AUTHZ_ERROR ${edgeCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      t.diagnostic(`AUTHZ_CASE ${Buffer.from(JSON.stringify({ ...edgeCase, status: "ERROR", error: error instanceof Error ? error.message : String(error) })).toString("base64")}`);
      throw error;
    }
    const matched = outcome.observed === edgeCase.expected && (edgeCase.expectedRaw === undefined || edgeCase.expectedRaw === outcome.raw);
    const noForbiddenCalls = edgeCase.expected !== "deny" || outcome.calls.length === 0;
    t.diagnostic(`${edgeCase.id}: expected=${edgeCase.expected}${edgeCase.expectedRaw ? `/${edgeCase.expectedRaw}` : ""}; observed=${outcome.observed}/${outcome.raw}; upstream calls=${outcome.calls.length}`);
    t.diagnostic(`AUTHZ_CASE ${Buffer.from(JSON.stringify({ id: edgeCase.id, category: edgeCase.category, title: edgeCase.title, surface: edgeCase.surface, expected: edgeCase.expected, expectedRaw: edgeCase.expectedRaw, severity: edgeCase.severity, finding: edgeCase.finding, status: matched && noForbiddenCalls ? "PASS" : "FAIL", ...outcome })).toString("base64")}`);
    assert.equal(outcome.observed, edgeCase.expected, `${edgeCase.id}: unexpected ${outcome.observed}; ${edgeCase.finding ?? "boundary regression"}`);
    if (edgeCase.expectedRaw !== undefined) assert.equal(outcome.raw, edgeCase.expectedRaw, `${edgeCase.id}: policy or validation result mismatch`);
    if (edgeCase.expected === "deny") {
      assert.equal(outcome.calls.length, 0, "a deny must emit no actual upstream tools/call");
      assert.notEqual(outcome.executed, true, "a deny must not execute a controlled wrapper");
    } else if (edgeCase.surface !== "http") {
      assert.equal(outcome.executed, true);
      assert.equal(outcome.calls.length, 1, "an allow must reach exactly one real upstream execution");
      assert.equal(outcome.calls[0].name, edgeCase.surface === "reconnect" ? "filesystem.read_secret" : edgeCase.input?.tool);
      assert.deepEqual(outcome.calls[0].arguments, edgeCase.input?.arguments ?? {});
    }
  });
}

test("receipts created by direct broker and HTTP cases retain chain integrity", () => {
  assert.equal(verifyReceipts().valid, true);
});
