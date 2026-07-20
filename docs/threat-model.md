# Threat model

## Asset and boundary

Atreides protects sensitive MCP tool actions. The boundary sits between an agent/client and an upstream tool capability. It does not claim to make model reasoning safe; it makes the execution decision inspectable and deterministic.

## Demonstrated threat

An attacker controls an external GitHub issue. Its instructions cause an agent to combine that untrusted content with secret-labelled `.env` data and request `diagnostics.send` to an unapproved external URL.

## Enforcement

The gateway blocks when all three conditions hold: untrusted provenance, secret sensitivity, and an unapproved destination. A receipt records the policy identifier, explanation, action envelope, previous receipt hash, and current SHA-256 hash.

## Limitations

The hackathon build uses an in-memory ledger and a deterministic policy evaluator. Production deployments require authenticated MCP transport, durable storage, identity-aware authorization, tenant isolation, policy lifecycle controls, and independent audit retention.
