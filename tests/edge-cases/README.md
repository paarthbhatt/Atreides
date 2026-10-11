# Authorization edge-case fixtures

`cases.json` is the threat-model matrix for the Atreides authorization
boundary. Each case has an `expected` security outcome (`allow` or `deny`),
and cases with an implementation gap carry a `finding` ID linked to the dated
matrix's gap analysis.

The test exercises the real `PolicyEngine`, `PolicyWrappedUpstream`,
`StdioMcpUpstream`, stdio MCP server, and HTTP authorization path. The upstream
fixture is local and synthetic; it returns the arguments it received and a
synthetic effect label.

Run the focused matrix from the repository root:

```bash
node_modules/.bin/tsx --test tests/edge-cases/authz-matrix.test.ts
```

Run the workspace suite, matrix, and all relevant type/lint checks with saved
evidence:

```bash
node tests/edge-cases/run.mjs
```

Every case is a strict security assertion. Known gaps fail the test command;
they are not skipped, TODO-marked, or converted into expected successes.
`deny` includes both `block` and `approval_required`; `expectedRaw`, when set,
also checks the precise policy/validation outcome. E-02 deliberately tests a
policy downgrade that still prevents execution.

An independent JSONL audit in a temporary directory beneath `fixtures/`
observes every actual upstream `tools/call`. Denials must have zero calls;
successful allows must have exactly one with the original name and arguments.
MCP errors, process exits, and timeouts are not automatically treated as denials.
Notification/batch cases check execution and transport liveness after settling.
Each server is a real subprocess using `apps/gateway/src/mcp.ts` and a configured
real `StdioMcpUpstream`. Temporary audit directories are removed after each case.

The fixture upstream intentionally accepts wider arguments than its published
strict schema so missing validation at the broker boundary is observable.
Its aliases explicitly expose the same synthetic secret-read capability;
this does not assume that arbitrary real MCP tools normalize their names.
All values are synthetic; `.env` is a selector string, never an actual file read,
and egress is an audit label, never a network request.

The dated run transcript is saved under `tests/reports/authz-test-run.txt`;
the findings and gap analysis are in `docs/authz-matrix-2026-10-11.md`.
