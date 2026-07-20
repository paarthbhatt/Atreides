# Contributing

## Local setup

Use Node 22 or newer.

```bash
npm install
npm run typecheck
npm run test --workspace=@atreides/gateway
npm run build --workspace=@atreides/web
```

Keep changes small and demonstrable. A new security behavior needs a focused regression test and an update to the threat model or attack catalog when it changes the stated guarantee.

## Design rules

- Preserve the provenance-first policy boundary; do not replace it with keyword filtering.
- Keep demo attacks synthetic and non-networked.
- Do not add a dependency when platform APIs or a small local abstraction will do.
- Maintain keyboard access, reduced-motion support, and a non-WebGL fallback for the product site.
