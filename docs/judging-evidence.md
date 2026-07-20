# Atreides judging evidence

Atreides is designed to make each judging dimension observable in under three minutes—not merely described in prose.

| Judging dimension | Evidence a judge can inspect | Where to verify |
| --- | --- | --- |
| Technological implementation | A real stdio MCP broker discovers configured tools, evaluates policy before forwarding, and records hash-chained receipts. The test suite includes a spawned reference MCP workspace server—not only mocked functions. | `apps/gateway/src/upstream.ts`, `apps/gateway/src/proxy.ts`, `examples/protected-workspace-mcp.mjs`, `apps/gateway/test/protected-upstream.test.ts` |
| Design | The product page narrates the attack path, runs a safe live replay, shows gateway health and active policy version, then verifies the actual receipt chain. It supports reduced motion. | `apps/web/app/page.tsx`, `apps/web/app/globals.css` |
| Potential impact | MCP agents commonly combine untrusted context with privileged tools. Atreides provides a concrete pre-execution boundary for developer teams that need deterministic controls and reviewable evidence. | `docs/threat-model.md`, `docs/attack-catalog.md`, `docs/production-path.md` |
| Quality of idea | The control is provenance-aware authorization: a source's trust level, sensitivity, destination, and tool impact determine whether it may authorize an action. This differs from classifying whether prompt text looks suspicious. | `apps/gateway/policies/default.json`, `docs/architecture.md` |

## Judge walkthrough

1. Start the gateway and product with the [quick start](../README.md#quick-start).
2. Open `http://localhost:3000` and select **Run safe attack**.
3. Observe a real `block` decision, its named policy, the policy version, and the receipt hash.
4. Observe the console's hash-chain verification state.
5. Use the [protected upstream demonstration](../README.md#run-the-protected-upstream-demonstration), or run `npm run test --workspace=@atreides/gateway`, to see both blocked and allowed paths against a real spawned stdio MCP server.

The safe replay uses only fake secret-labelled data and `attacker.invalid`; it makes no external connection.
