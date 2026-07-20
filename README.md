# Atreides

**Proof-carrying MCP security for AI agents.**

Atreides tracks the path from untrusted context to MCP action, evaluates deterministic policy, and produces a hash-chained trust receipt. Its controlled wrapped-tool demo enforces that decision before fixture execution. It is a safe local demonstration of indirect prompt injection attempting to exfiltrate secret-labelled data.

## What makes it different

Prompt detection asks whether text *looks* malicious. Atreides evaluates whether untrusted context is authorizing a sensitive capability. The decision is based on provenance, data sensitivity, destination, and action impact—not an LLM's confidence score.

## Quick start

Requires Node 22+.

```bash
npm install
npm run dev
```

In a second terminal, run the security gateway:

```bash
npm run start --workspace=@atreides/gateway
```

Open `http://localhost:3000` for the product experience. Trigger the safe attack fixture:

```bash
curl -X POST http://localhost:4100/v1/demo/indirect-prompt-injection
```

The response is a `block` receipt under `atreides/no-untrusted-secret-egress`. The fixture uses only fake local data and `attacker.invalid`; it does not contact an external service.

## MCP integration

Atreides also exposes the policy evaluator as a real stdio MCP tool:

```json
{
  "mcpServers": {
    "atreides": {
      "command": "npm",
      "args": ["run", "mcp", "--workspace=@atreides/gateway"],
      "cwd": "<absolute-path-to-atreides>"
    }
  }
}
```

The server exposes `evaluate_agent_action` for a proposed action and `invoke_atreides_wrapped_tool` for the controlled policy-wrapped fixtures. The latter evaluates policy before it invokes a fixture tool. See [MCP integration](docs/mcp-integration.md) for the exact schemas and boundary.

## API

- `GET /health` — gateway status
- `GET /v1/receipts` — append-only in-memory receipt ledger
- `POST /v1/demo/indirect-prompt-injection` — safe red-team fixture
- `POST /v1/evaluate` — evaluate an action payload

## Verification

```bash
npm run typecheck
npm run test --workspace=@atreides/gateway
npm run build --workspace=@atreides/web
```

## Codex / GPT-5.6 build record

Codex was used during this build for architecture decomposition, TypeScript scaffolding, policy-test design, visual-system iteration, and verification. `docs/codex-build-log.md` records genuine contributions only; add the required Devpost `/feedback` session ID before submission.

## Repository map

```text
apps/web       Product narrative and interactive attack replay
apps/gateway   Provenance-aware policy evaluator and receipt service
docs/          Threat model, attack catalog, and hackathon notes
```

See [architecture](docs/architecture.md), [threat model](docs/threat-model.md), [attack catalog](docs/attack-catalog.md), [MCP integration](docs/mcp-integration.md), [verification/deploy notes](docs/verification-and-deploy.md), and [Devpost material](docs/devpost-submission.md).
