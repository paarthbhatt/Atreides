# Atreides MCP authorization edge-case matrix

**Work-order date:** 2026-10-11 (execution UTC timestamps are in the evidence)  
**Scope:** the real Atreides policy evaluator, pre-execution wrapper, configured
stdio upstream broker, MCP server, and HTTP bearer-token boundary  
**Fixtures:** [`tests/edge-cases/`](../tests/edge-cases/)  
**Evidence:** [`tests/reports/authz-test-run.txt`](../tests/reports/authz-test-run.txt)
and [`tests/reports/authz-results.json`](../tests/reports/authz-results.json)

## Executive result

The matrix contains **52 cases** across the five requested threat categories.
The ordinary workspace suite passes, but the strict edge-case suite exposes
**20 failures**:

| Result | Count |
|---|---:|
| Cases matching the declared expectation | 32 |
| Cases failing the declared expectation | 20 |
| Unexpected `allow` decisions | 19 |
| Unexpected allows that reached the synthetic upstream | 17 |
| Unexpected allows at the HTTP evaluation-only endpoint | 2 |
| Deny with a weaker-than-expected policy result | 1 |
| Actual upstream calls after an observed deny | 0 |

The 20 failures are intentional security findings, not skipped or TODO tests.
The matrix command exits nonzero when a known gap is reproduced. No production
source was changed: the requested path restriction permits changes only under
`tests/`, `docs/`, and the new fixtures, so each gap has a proposed fix below.

Verification captured in the report:

| Check | Result |
|---|---|
| Existing gateway/workspace tests | 10 passed, 0 failed |
| Strict edge-case matrix | 54 test assertions, 34 passed, 20 failed |
| Edge-case TypeScript check | passed |
| Edge-case ESLint | passed |
| Workspace lint | passed |
| Gateway typecheck | passed |
| SDK typecheck | passed |
| Web typecheck with incremental output disabled | passed |

The 54 assertions are the 52 fixture cases plus matrix-integrity and receipt
chain checks. The run is reproducible with:

```bash
node tests/edge-cases/run.mjs
```

## Authorization model under test

### Decision inputs and rules

`apps/gateway/src/index.ts:6-11` defines an action as `tool`, optional `destination`,
optional `writes`, a `context` array, and an optional `actor`. The receipt is
created by `evaluate()` before an allowed broker call is forwarded.

`apps/gateway/src/policy.ts:51-67` derives four facts:

1. `untrusted` is true when any context envelope has a trust value other than
   `trusted`.
2. `secret` is true when any envelope has sensitivity `secret`.
3. A non-empty `destination` is `approved` only when the complete action
   destination is an exact entry in the allowlist. Missing or empty destination
   is also treated as `approved`, without inspecting tool arguments.
4. `writes` is the boolean value supplied by the action.

The first matching rule wins (`apps/gateway/src/policy.ts:20-29`, default bundle
version `2026.07.1`):

| Rule order | Match | Decision |
|---|---|---|
| 1 | untrusted + `filesystem.read_secret` | `block` |
| 2 | untrusted + secret + external destination | `block` |
| 3 | untrusted + writes | `approval_required` |
| 4 | untrusted + external destination | `approval_required` |
| 5 | fallback | `allow` |

### Identity, scope, provenance, and schema registration

| Input or credential | Implemented behavior |
|---|---|
| `ATREIDES_API_TOKEN` | Optional shared HTTP token; no token requirement when unset. It is not a scoped token or a stdio credential. |
| MCP `clientInfo` / protocol version | Used for protocol initialization, not an authenticated principal. |
| `actor.id`, `actor.role`, and client-supplied scopes | The optional actor type exists, but the policy engine does not read it. There is no scope-token model. |
| Context `trust` | `trusted`, `external`, or `untrusted`, supplied by the caller. No source-to-trust attestation is verified. |
| Context `sensitivity` | `public`, `internal`, `confidential`, or `secret`, supplied by the caller. No classifier is consulted. |
| Context `contentHash` | Optional arbitrary string. It is not validated against source content or bound to a principal. |
| Receipt signing key | Optional HMAC evidence signing; it attests the recorded decision, not the truth of the caller's provenance claims. |
| Outer MCP schema | Registered using Zod in `apps/gateway/src/mcp.ts:11-79`; enforces envelope types and the controlled wrapper's enum. |
| Discovered upstream schema | Returned by `tools/list` in `apps/gateway/src/upstream.ts:29-35`; passed through as metadata, not compiled into validation. |

### Enforcement points

- `apps/gateway/src/proxy.ts:11-17`, `PolicyWrappedUpstream.invoke()`, discovers the exact requested name, calls
  `evaluate()`, and calls upstream only for `allow`.
- `apps/gateway/src/wrapper.ts:24-30`, `invokeWrappedTool()`, applies the same pre-execution pattern to the three
  controlled demo tools.
- `apps/gateway/src/mcp.ts:11-79` validates its public MCP input with Zod, then calls the real wrapper
  or configured upstream broker.
- `apps/gateway/src/upstream.ts:22-35` performs the real stdio `initialize`, `tools/list`, and
  `tools/call` exchange. The fixture writes a JSONL audit record for every
  actual execution.
- `apps/gateway/src/index.ts:57-62,73-86` authenticates HTTP with an optional environment token, but the
  `actor` object is not consulted by `PolicyEngine`.

The edge-case tests do not replace these enforcement points with mocks. They
start `apps/gateway/src/mcp.ts` as a child process, connect a real
`StdioMcpUpstream`, and use a local synthetic upstream whose manifest includes
strict schemas and explicit aliases. A deny must produce zero upstream audit
records; an allow must produce exactly one record with the original name and
arguments. The fixture never reads a real secret and never opens a network
connection.

### Attacker model and expected contract

The attacker can submit MCP requests, notifications, and malformed frames;
control the invocation envelope and arguments; and reconnect using a different
client name and protocol version. The tests also model a configured upstream
that exposes explicitly registered aliases and implements a wider argument
surface than its declared schema. Those capabilities are synthetic but exercise
real gateway discovery and forwarding.

The expected denies are the desired hardened contract: protected aliases retain
their capability restriction, discovered strict schemas constrain payloads,
impact/destination cannot be lowered by caller metadata, and privileged actions
require attested identity and provenance. F5 and F7 expose missing production
controls already acknowledged by `docs/threat-model.md:15-17`; they do not imply
that the prototype previously implemented identity-aware authorization. Alias
cases require an upstream that actually publishes the alias; an arbitrary
undiscovered spelling is rejected, as A-04 demonstrates.

Severity denotes boundary impact under those prerequisites: critical for
untrusted synthetic secret egress/read or destructive execution, high for
protected aliases, schema violations, or missing evaluation scopes, medium for
shape/policy downgrades, and low for HTTP scheme parsing without token bypass.
Passing cases retain the potential attack's severity; benign allow controls use
`none`.

## Category summary

| Category | Cases | Pass | Fail | Main exposure |
|---|---:|---:|---:|---|
| A — tool-name aliasing / path confusion | 9 | 6 | 3 | Exact-name protected list misses aliases |
| B — parameter smuggling | 12 | 7 | 5 | Arguments and destructive metadata can be caller-controlled |
| C — schema mismatch | 6 | 1 | 5 | Discovered `inputSchema` is not enforced |
| D — MCP protocol-level tricks | 13 | 10 | 3 | No stdio identity/scope binding; weak HTTP scheme parsing |
| E — context injection | 12 | 8 | 4 | Provenance and sensitivity labels are caller-supplied |
| **Total** | **52** | **32** | **20** | |

## Detailed matrix

`allow/allow` means the boundary decision was `allow` and the raw policy result
was `allow`. `deny/block`, `deny/approval_required`, and
`deny/input-error` mean no upstream execution occurred. `calls` is the count
observed by the synthetic upstream audit point.

### A — tool-name aliasing / path confusion

| ID | Case | Expected | Observed | Calls | Result | Severity | Finding |
|---|---|---|---|---:|---|---|---|
| A-01 | Exact protected secret-read name | deny / block | deny/block | 0 | PASS | high | — |
| A-02 | Discovered uppercase alias of the same secret capability | deny | allow/allow | 1 | FAIL | high | F1 |
| A-03 | Discovered noncanonical path alias of the secret capability | deny | allow/allow | 1 | FAIL | high | F1 |
| A-04 | Undiscovered trailing-space name | deny / unknown-tool | deny/unknown-tool | 0 | PASS | medium | — |
| A-05 | Discovered alternate name `fs.read_secret` | deny | allow/allow | 1 | FAIL | high | F1 |
| A-06 | Controlled wrapper rejects an uppercase alias | deny / input-error | deny/input-error | 0 | PASS | medium | — |
| A-07 | Exact approved destination permits a public egress | allow / allow | allow/allow | 1 | PASS | none | — |
| A-08 | Approved-host prefix with an attacker suffix | deny / block | deny/block | 0 | PASS | high | — |
| A-09 | Approved hostname in URL userinfo | deny / block | deny/block | 0 | PASS | high | — |

### B — parameter smuggling

| ID | Case | Expected | Observed | Calls | Result | Severity | Finding |
|---|---|---|---|---:|---|---|---|
| B-01 | Extra `includeSecret` key on a strict public read | deny | allow/allow | 1 | FAIL | high | F2 |
| B-02 | Nested file selector smuggles a synthetic `.env` read | deny | allow/allow | 1 | FAIL | high | F2 |
| B-03 | Argument destination disagrees with approved envelope metadata | deny | allow/allow | 1 | FAIL | critical | F3 |
| B-04 | `writes=false` overrides the discovered destructive annotation | deny | allow/allow | 1 | FAIL | critical | F4 |
| B-05 | Omitted `writes` respects the destructive annotation | deny / approval_required | deny/approval_required | 0 | PASS | high | — |
| B-06 | Explicit `writes=true` cannot lower a public read's impact | deny / approval_required | deny/approval_required | 0 | PASS | medium | — |
| B-07 | Top-level arguments array fails the MCP record schema | deny / input-error | deny/input-error | 0 | PASS | medium | — |
| B-08 | String `false` fails the MCP boolean schema | deny / input-error | deny/input-error | 0 | PASS | medium | — |
| B-09 | Valid array-of-objects payload | allow / allow | allow/allow | 1 | PASS | none | — |
| B-10 | Object-of-arrays substitutes for array-of-objects | deny | allow/allow | 1 | FAIL | medium | F2 |
| B-11 | Extra `writes=false` cannot override the controlled wrapper | deny / block | deny/block | 0 | PASS | high | — |
| B-12 | Valid public read with untrusted provenance | allow / allow | allow/allow | 1 | PASS | none | — |

### C — schema-mismatch attacks

| ID | Case | Expected | Observed | Calls | Result | Severity | Finding |
|---|---|---|---|---:|---|---|---|
| C-01 | Numeric body violates the discovered string schema | deny | allow/allow | 1 | FAIL | high | F2 |
| C-02 | Undeclared secret key violates `additionalProperties=false` | deny | allow/allow | 1 | FAIL | high | F2 |
| C-03 | Required `body` is missing | deny | allow/allow | 1 | FAIL | high | F2 |
| C-04 | Nested object substitutes for the declared string body | deny | allow/allow | 1 | FAIL | high | F2 |
| C-05 | Nested array item violates the declared value type | deny | allow/allow | 1 | FAIL | medium | F2 |
| C-06 | Valid strict-schema publish with trusted provenance | allow / allow | allow/allow | 1 | PASS | none | — |

### D — MCP protocol-level tricks

| ID | Case | Expected | Observed | Calls | Result | Severity | Finding |
|---|---|---|---|---:|---|---|---|
| D-01 | Normal MCP request blocks a protected secret read | deny / block | deny/block | 0 | PASS | high | — |
| D-02 | Protected `tools/call` notification does not execute | deny | deny/ignored-or-rejected | 0 | PASS | high | — |
| D-03 | Mixed allowed-and-blocked JSON-RPC batch is rejected/ignored | deny | deny/ignored-or-rejected | 0 | PASS | high | — |
| D-04 | Reconnect as a guest on an older protocol and self-claim trust | deny | allow/allow | 1 | FAIL | critical | F5 |
| D-05 | Incorrect HTTP bearer token | deny / HTTP 401 | deny/HTTP 401 | 0 | PASS | high | — |
| D-06 | Valid token with guest actor has no scope enforcement | deny | allow/allow | 0 | FAIL | high | F5 |
| D-07 | Bare token is accepted without the Bearer scheme | deny | allow/allow | 0 | FAIL | low | F6 |
| D-08 | Missing HTTP bearer token | deny / HTTP 401 | deny/HTTP 401 | 0 | PASS | high | — |
| D-09 | Valid token and benign HTTP evaluation | allow / allow | allow/allow | 0 | PASS | none | — |
| D-10 | Allowed tool cannot execute as a notification | deny | deny/ignored-or-rejected | 0 | PASS | high | — |
| D-11 | Invalid JSON-RPC version cannot execute an allowed tool | deny | deny/ignored-or-rejected | 0 | PASS | medium | — |
| D-12 | Unknown method cannot dispatch `tools/call` parameters | deny | deny/ignored-or-rejected | 0 | PASS | medium | — |
| D-13 | Cancellation notification does not grant permission | deny / block | deny/block | 0 | PASS | medium | — |

For D-02, D-03, and D-10 through D-12, the current MCP transport does not
create an authorization receipt for the unsupported frame; it leaves the
transport live and produces no upstream call. The security result is therefore
safe non-execution, rather than proof that a future batch implementation would
evaluate every item correctly.

### E — context injection into the permission decision

| ID | Case | Expected | Observed | Calls | Result | Severity | Finding |
|---|---|---|---|---:|---|---|---|
| E-01 | Attacker-controlled source self-labels trusted for secret egress | deny | allow/allow | 1 | FAIL | critical | F7 |
| E-02 | Relabelled secret lowers block to `approval_required` | deny / block | deny/approval_required | 0 | FAIL | medium | F7 |
| E-03 | Empty provenance authorizes the exact protected secret read | deny | allow/allow | 1 | FAIL | critical | F7 |
| E-04 | Prompt text cannot override honest untrusted labels | deny / block | deny/block | 0 | PASS | high | — |
| E-05 | Trusted public provenance permits a benign read | allow / allow | allow/allow | 1 | PASS | none | — |
| E-06 | Trusted context does not erase a second untrusted envelope | deny / block | deny/block | 0 | PASS | high | — |
| E-07 | Omitted envelope destination hides external argument destination | deny | allow/allow | 1 | FAIL | critical | F3 |
| E-08 | Nested argument context cannot replace the real envelope | deny / block | deny/block | 0 | PASS | high | — |
| E-09 | Client `_meta` permission cannot override the evaluator | deny / block | deny/block | 0 | PASS | high | — |
| E-10 | Unknown trust enum is rejected by the MCP schema | deny / input-error | deny/input-error | 0 | PASS | medium | — |
| E-11 | Missing context is rejected rather than defaulted | deny / input-error | deny/input-error | 0 | PASS | high | — |
| E-12 | Unknown sensitivity enum is rejected by the MCP schema | deny / input-error | deny/input-error | 0 | PASS | medium | — |

## Gap analysis and proposed fixes

The finding IDs below are referenced by the matrix. They describe the smallest
safe design change that would close the reproduced boundary; they are proposals
only because production source edits were outside the permitted paths.

### F1 — protected capability identity is exact-name only

**Cases:** A-02, A-03, A-05  
**Severity:** high  
**Observed:** explicitly discovered aliases that execute the same synthetic
secret-read capability receive `atreides/default-allow` and reach upstream.

`PolicyEngine` checks `match.tools.includes(action.tool)` as a literal string.
`PolicyWrappedUpstream` also looks up the literal name, so a case, path, or
alternate-name alias can bypass the protected name.

**Proposed fix:** maintain a capability registry keyed by a stable protected
capability ID, populated from trusted tool metadata. Treat an alias as the same
capability only when the registry explicitly maps it; reject or require review
for an unknown name that is newly introduced by `tools/list`. Do not blindly
lowercase or normalize all MCP names because MCP tool names are normally
case-sensitive and distinct names can be legitimate. Add alias-collision tests
and evaluate the canonical capability ID, not the display name.

### F2 — discovered schemas are informational, not enforced

**Cases:** B-01, B-02, B-10, C-01 through C-05  
**Severity:** medium-high  
**Observed:** eight invalid payloads reach the real synthetic upstream, including
extra keys, nested smuggling, wrong primitive types, missing required fields,
and object-of-arrays versus array-of-objects confusion.

The configured MCP tool input accepts `arguments: z.record(z.string(),
z.unknown())`, while `PolicyWrappedUpstream` forwards the record without
validating it against the discovered `inputSchema`.

**Proposed fix:** validate the exact arguments object against the discovered
JSON Schema before policy evaluation and again use the validated/normalized
value for the upstream call. Reject wrong types, missing required fields,
unknown keys when `additionalProperties` is false, and malformed nested arrays.
Keep the failure before `tools/call`; record a validation-deny receipt with the
tool name and schema version, without logging secret argument values.

### F3 — policy destination and executable destination can disagree

**Cases:** B-03, E-07  
**Severity:** critical  
**Observed:** an external destination in `arguments.destination` is forwarded
while the policy sees no action destination (or sees the separately supplied
approved destination). The action receives `default-allow`.

**Proposed fix:** define destination extraction once per capability. For tools
whose arguments contain a destination, parse it before policy evaluation and
reject any mismatch between the extracted destination, envelope destination,
and caller metadata. Pass the canonical parsed destination to both the policy
engine and the executor. If extraction is not possible, require explicit
destination metadata and fail closed for secret or external-capable tools.

### F4 — caller-controlled `writes=false` lowers impact

**Case:** B-04  
**Severity:** critical  
**Observed:** `workspace.publish_release_notes` is declared
`destructiveHint: true`, but an explicit `writes: false` makes the proxy pass
`writes: false` to policy. The untrusted publish executes with
`default-allow`.

**Proposed fix:** derive impact monotonically:
`writes = Boolean(invocation.writes) || Boolean(tool.annotations?.destructiveHint)`.
For higher assurance, ignore caller `writes=false` entirely when the discovered
manifest says destructive and require a trusted capability registry for any
override. Test both omission and explicit false.

### F5 — no authenticated stdio identity or scope binding

**Cases:** D-04, D-06  
**Severity:** high-critical  
**Observed:** a reconnecting client can negotiate an older protocol, claim a
trusted context, and execute `filesystem.read_secret`; an HTTP-authenticated
guest actor also receives `default-allow` because `actor.id` and `actor.role`
are ignored.

D-04 requested and negotiated `2024-11-05` on the new guest session. The
successful read demonstrates the missing principal/scope binding combined with
self-asserted trust; it does not establish that the older protocol version alone
changes policy enforcement. D-06 and D-07 are HTTP evaluation-only results, not
upstream execution findings.

**Proposed fix:** authenticate each MCP session and bind an immutable principal
and scopes to the session before accepting `tools/call`. Require a transport
credential (mTLS, workload identity, or scoped bearer credential), reject
protocol downgrade unless explicitly allowed by policy, and derive trust and
capability scope from that principal rather than from the request's `actor` or
context claims. A reconnect must create a new authenticated session, not inherit
or self-assert authority.

### F6 — HTTP parser accepts a bare token

**Case:** D-07  
**Severity:** low  
**Observed:** `Authorization: edge-token` is accepted because the implementation
removes a Bearer prefix if present but does not require it.

The correct token value is still required. This is scheme-validation leniency,
not a way to guess or bypass the token secret.

**Proposed fix:** parse the header as exactly `Bearer <non-empty-token>` with a
case-insensitive scheme check, reject all other forms with 401, and keep the
constant-time token comparison after parsing.

### F7 — provenance and sensitivity are caller assertions

**Cases:** E-01, E-02, E-03  
**Severity:** medium-critical  
**Observed:** an attacker can label its own source `trusted`; an empty context
is sufficient for a protected secret read; and relabelling `.env` as public
downgrades the intended block to `approval_required` (still no execution, but
not the expected hard block). These values are accepted directly by the action
payload.

**Proposed fix:** require at least one authenticated, server-attested context
envelope for sensitive capabilities and fail closed when context is empty,
missing, contradictory, or unverifiable. Bind source and trust to a provenance
service or signed envelope; derive sensitivity from a trusted data-classification
registry. Treat an unverified or downgraded secret classification as secret for
policy purposes, and require an explicit approval identity for any
`approval_required` result.

## Residual protocol notes

Notifications and JSON-RPC batches currently do not produce upstream calls in
the tested stdio transport. This is a useful non-execution result, but the
transport does not emit a per-item deny receipt for ignored batch items. If batch
support is added, each request must be evaluated independently, notifications
must not be treated as implicit approval, and a mixed batch must not allow a
protected item to hide behind an allowed item. Re-test D-02, D-03, and D-10
through D-12 after any MCP SDK or transport upgrade.

## Test artifacts

- `tests/edge-cases/cases.json` — 52 declarative cases and expected outcomes.
- `tests/edge-cases/authz-matrix.test.ts` — strict real-boundary assertions.
- `tests/edge-cases/fixtures/upstream-tools.json` — synthetic manifest with
  aliases and strict schemas.
- `tests/edge-cases/fixtures/schema-bypass-upstream.mjs` — local permissive
  execution point with JSONL auditing; no network or real secret access.
- `tests/reports/authz-test-run.txt` — complete command transcript.
- `tests/reports/authz-results.json` — machine-readable per-case evidence.

The work order requested a root-level `reports/authz-test-run.txt`. Its location
is `tests/reports/authz-test-run.txt` so the deliverable stays inside the user's
explicit writable-path restriction. Run `node tests/edge-cases/run.mjs`
separately from `npm test`: the latter's workspace glob discovers only
`apps/gateway/test/*.test.ts`.
