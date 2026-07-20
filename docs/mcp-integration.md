# MCP integration

Atreides currently exposes a **stdio MCP server** with pre-execution policy tools. It evaluates proposed actions and returns structured trust receipts. The demo also includes a controlled wrapped-tool fixture that proves a policy decision happens before execution; it does not yet proxy arbitrary upstream MCP servers.

## Configure a client

Add Atreides to a client configuration that supports local stdio MCP servers. Replace the path with the absolute repository path.

```json
{
  "mcpServers": {
    "atreides": {
      "command": "npm",
      "args": ["run", "mcp", "--workspace=@atreides/gateway"],
      "cwd": "C:\\path\\to\\Atreides"
    }
  }
}
```

Run `npm install` first. The process is local and communicates over standard input/output; do not print logs to stdout in MCP mode.

## Available tool

### `evaluate_agent_action`

Call this before an agent performs a sensitive action. The tool accepts:

```json
{
  "tool": "diagnostics.send",
  "destination": "https://attacker.invalid/collect",
  "writes": false,
  "context": [
    {
      "source": "github-issue#184",
      "trust": "untrusted",
      "sensitivity": "public",
      "contentHash": "fixture:issue-184"
    },
    {
      "source": ".env",
      "trust": "trusted",
      "sensitivity": "secret",
      "contentHash": "fixture:fake-secret"
    }
  ]
}
```

The response is JSON text containing a receipt with `decision`, `reason`, `policy`, timestamp, prior receipt hash, and receipt hash.

### `invoke_atreides_wrapped_tool`

This tool invokes one of the controlled upstream fixtures only after Atreides evaluates it. Available names are `workspace.readme`, `filesystem.read_secret`, and `diagnostics.send`.

For example, untrusted context attempting `filesystem.read_secret` returns `block` under `atreides/no-untrusted-secret-read`; the simulated secret-read fixture is never executed.

## Current decisions

| Condition | Decision | Policy |
| --- | --- | --- |
| Untrusted context + secret-labelled data + unapproved destination | `block` | `atreides/no-untrusted-secret-egress` |
| Untrusted context + `filesystem.read_secret` | `block` | `atreides/no-untrusted-secret-read` |
| Untrusted context + write or unapproved destination | `approval_required` | `atreides/untrusted-high-impact-action` |
| Otherwise | `allow` | `atreides/default-allow` |

Approved destinations are currently hard-coded for the demo: `internal://diagnostics` and `https://api.example.internal`.

## Important limitation

The calling agent must obey the decision. This version supplies a real MCP policy tool and records HTTP decisions, but it is **not yet an inline MCP transport proxy** and cannot stop an agent that bypasses it. The demo’s security claim is scoped to decision evaluation and evidence generation.
