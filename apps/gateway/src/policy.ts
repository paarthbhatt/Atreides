import { readFileSync } from "node:fs";
import type { Action, Decision } from "./index.js";

export type PolicyRule = {
  id: string;
  decision: Decision;
  reason: string;
  match: {
    untrusted?: boolean;
    secret?: boolean;
    tools?: string[];
    destination?: "approved" | "external";
    writes?: boolean;
  };
};

export type PolicyBundle = { version: string; approvedDestinations: string[]; rules: PolicyRule[] };
export type PolicyDecision = Pick<PolicyRule, "id" | "decision" | "reason">;

export const defaultPolicy: PolicyBundle = {
  version: "2026.07.1",
  approvedDestinations: ["internal://diagnostics", "https://api.example.internal"],
  rules: [
    { id: "atreides/no-untrusted-secret-read", decision: "block", reason: "Untrusted context cannot authorize a secret-read capability.", match: { untrusted: true, tools: ["filesystem.read_secret"] } },
    { id: "atreides/no-untrusted-secret-egress", decision: "block", reason: "Untrusted context cannot authorize transmission of secret-labelled data to an unapproved destination.", match: { untrusted: true, secret: true, destination: "external" } },
    { id: "atreides/untrusted-high-impact-action", decision: "approval_required", reason: "Untrusted context reached a high-impact capability; explicit human approval is required.", match: { untrusted: true, writes: true } },
    { id: "atreides/untrusted-external-action", decision: "approval_required", reason: "Untrusted context reached an unapproved destination; explicit human approval is required.", match: { untrusted: true, destination: "external" } },
    { id: "atreides/default-allow", decision: "allow", reason: "No protected capability crosses an untrusted boundary.", match: {} },
  ],
};

function isPolicyBundle(value: unknown): value is PolicyBundle {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PolicyBundle>;
  return typeof candidate.version === "string" && Array.isArray(candidate.approvedDestinations) && Array.isArray(candidate.rules)
    && candidate.rules.every((rule) => typeof rule.id === "string" && typeof rule.reason === "string" && ["allow", "block", "approval_required"].includes(rule.decision ?? ""));
}

export function loadPolicyBundle(path = process.env.ATREIDES_POLICY_PATH): PolicyBundle {
  if (!path) return defaultPolicy;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isPolicyBundle(parsed)) throw new Error(`Invalid Atreides policy bundle at ${path}`);
  return parsed;
}

export class PolicyEngine {
  readonly bundle: PolicyBundle;

  constructor(bundle = loadPolicyBundle()) { this.bundle = bundle; }

  evaluate(action: Action): PolicyDecision {
    const facts = {
      untrusted: action.context.some((item) => item.trust !== "trusted"),
      secret: action.context.some((item) => item.sensitivity === "secret"),
      destination: action.destination && !this.bundle.approvedDestinations.includes(action.destination) ? "external" : "approved",
      writes: Boolean(action.writes),
    } as const;
    const matched = this.bundle.rules.find((rule) => {
      const match = rule.match;
      return (match.untrusted === undefined || match.untrusted === facts.untrusted)
        && (match.secret === undefined || match.secret === facts.secret)
        && (match.writes === undefined || match.writes === facts.writes)
        && (match.destination === undefined || match.destination === facts.destination)
        && (match.tools === undefined || match.tools.includes(action.tool));
    });
    if (!matched) throw new Error("Policy bundle has no fallback rule.");
    return { id: matched.id, decision: matched.decision, reason: matched.reason };
  }
}
