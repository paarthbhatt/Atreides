# Devpost submission material

## Project summary

Atreides is proof-carrying MCP security for AI agents. It evaluates the path from untrusted context to a requested MCP action, returns a deterministic allow/block/approval decision, and records a hash-chained trust receipt. The working demo recreates a safe indirect prompt-injection attempt to send fake secret-labelled data to an unapproved destination, then blocks it under a named policy.

## What it does today

- Runs a local HTTP policy gateway with health, evaluation, policy, receipt-verification, and safe-fixture endpoints.
- Exposes `evaluate_agent_action`, a controlled `invoke_atreides_wrapped_tool`, and configured upstream MCP discovery/invocation through a real stdio MCP server.
- Enforces policy before controlled fixture execution and configured stdio upstream MCP calls; demonstrates blocked secret-read/egress and allowed public-read paths.
- Evaluates provenance trust, data sensitivity, destination, and write impact.
- Returns hash-chained receipts with optional durable JSONL persistence and HMAC signing.
- Ships a visual web product experience with a live policy laboratory, receipt-chain verification, and Docker Compose demo stack.

## Why it is different

Most prompt-injection defenses concentrate on detecting suspicious wording. Atreides makes the action boundary explicit: untrusted provenance cannot by itself authorize secret egress or other high-impact tool actions. The decision is explainable through a policy name, human-readable reason, and receipt—not a model confidence score.

## Honest limitations

This prototype is a pre-execution evaluator and stdio MCP broker, not a universal prompt-injection solution. It does not yet proxy arbitrary MCP transports or prevent an agent from bypassing Atreides outside the configured broker boundary. Durable receipts and bearer authentication are opt-in configuration; production needs managed keys, identity-aware authorization, and an access-controlled audit store. The demo uses only local fake data and a `.invalid` destination.

## Suggested video script (≤3 minutes)

1. **0:00-0:20 - Before:** “The same indirect instruction reaches a privileged action. In an unprotected agent, there is no deterministic boundary between untrusted context and an outbound tool call.” Run the clearly labelled synthetic baseline. State that it never sends data.
2. **0:20-1:00 - After:** Run **Run before/after proof**. Show the same secret-labelled external action being blocked under `atreides/no-untrusted-secret-egress` before execution. Say: “This decision is independent of an LLM deciding whether the prompt looked suspicious.”
3. **1:00-1:35 - Audit:** Pause on the actual policy name, reason, version, SHA-256 receipt, and live hash-chain verification. Explain that this establishes why the action was denied.
4. **1:35-2:15 - Developer fit:** Show the protected upstream MCP reference server, then the blocked and allowed tests. Explain that Atreides discovers and guards a real stdio upstream process.
5. **2:15-2:45 - Policy lab:** Change a fact in the live policy laboratory and evaluate it. This demonstrates deterministic policy-as-code rather than one hard-coded demo path.
6. **2:45-3:00 - Difference:** “Atreides governs whether provenance can authorize capability. It does not guess from prompt wording.”

If the public frontend cannot reach its configured gateway, the proof button enters a visibly labelled offline presentation fallback. Do not present this local result as evidence: it does not call the gateway or verify a hash chain. The real gateway path remains the proof for the implementation and audit claims.

## Codex / GPT-5.6 disclosure

Use only the statement backed by the build log: Codex/GPT-5.6 assisted the developer with architecture decomposition, TypeScript scaffolding, policy-test design, visual-system iteration, and verification. The developer reviewed the output and selected the final security scope. Before submitting, add the actual Codex `/feedback` session ID and remove any unverified/placeholder entries from [codex-build-log.md](codex-build-log.md).

## Submission checklist

- [ ] Public repository URL and public demo-video URL.
- [ ] Screenshot/video shows the safe blocked fixture and receipt.
- [ ] README quick start and verification commands pass from a clean clone.
- [ ] Exact implementation limitations are included in Devpost text.
- [ ] Actual Codex `/feedback` session ID is present.
- [ ] No real credentials, user data, attack targets, or misleading claims.
