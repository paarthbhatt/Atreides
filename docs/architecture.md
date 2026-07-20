# Architecture

```text
MCP client / agent → Atreides stdio MCP broker → policy evaluation → configured upstream MCP tool
                                      ↓
                         signed hash-chained trust receipt → operator console / ledger
```

Each action carries context envelopes: source, trust level, sensitivity, and content hash. The gateway evaluates the requested tool, destination, write impact, and envelopes. It returns `allow`, `block`, or `approval_required` with an evidence receipt.

The public demo exposes both an HTTP API for the visual replay and a stdio MCP server. The MCP server provides direct evaluation, controlled policy-wrapped fixtures, and a configured stdio upstream broker. It discovers tools with `tools/list`, evaluates policy, and emits a `tools/call` only for an allow decision. It does not claim transparent support for every MCP transport or an unavoidable inline enforcement path.
