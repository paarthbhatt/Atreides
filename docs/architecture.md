# Architecture

```text
MCP client / agent → Atreides stdio MCP server → policy evaluation → controlled fixture tool
                                      ↓
                           hash-chained trust receipt → operator console
```

Each action carries context envelopes: source, trust level, sensitivity, and content hash. The gateway evaluates the requested tool, destination, write impact, and envelopes. It returns `allow`, `block`, or `approval_required` with an evidence receipt.

The public demo exposes both an HTTP API for the visual replay and a stdio MCP server. The MCP server provides direct evaluation plus controlled policy-wrapped fixture tools, enforcing the decision before tool execution. It does not yet proxy arbitrary third-party upstream MCP servers; that deliberately narrower boundary keeps this hackathon demo safe and auditable.
