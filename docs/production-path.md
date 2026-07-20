# Production path

Atreides now provides a credible local enforcement vertical slice. Production deployment remains an integration decision, not a toggle.

## Included in this repository

- Versioned JSON policy bundle with first-match deterministic evaluation.
- Configured stdio upstream MCP discovery and policy-wrapped invocation.
- Optional HTTP bearer token and fixed-window per-IP rate limit.
- Optional JSONL receipt persistence with an HMAC-SHA-256 signature.
- Typed workspace SDK, CLI, tests, and Docker smoke coverage.

## Required before a production claim

1. Put Atreides behind a TLS-terminating identity-aware proxy and enforce mTLS or workload identity between agents, Atreides, and upstream services.
2. Store `ATREIDES_API_TOKEN` and receipt signing keys in a managed secrets system; rotate keys and record key IDs.
3. Replace local JSONL with encrypted append-only storage that supports retention, access control, and independent verification.
4. Integrate organization-specific tool metadata, destination allowlists, data classifications, and approval identities into policy bundles.
5. Deploy the stdio broker as a sidecar or gateway where all sensitive agent traffic is required to pass through it.
6. Export receipts and policy outcomes through OpenTelemetry or the organization’s SIEM.

## Configuration boundary

Copy `.env.example` into a secret manager or shell environment. The gateway does not load `.env` itself; this avoids accidental secret-file behavior and makes the deployment platform responsible for injection.
