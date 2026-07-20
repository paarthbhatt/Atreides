# Verification and deploy checklist

## Local verification

From the repository root:

```bash
npm install
npm run typecheck
npm run test --workspace=@atreides/gateway
npm run build --workspace=@atreides/web
```

Start both services in separate terminals:

```bash
npm run dev
npm run start --workspace=@atreides/gateway
```

Confirm the gateway is healthy:

```bash
curl http://localhost:4100/health
```

Expected: JSON containing `"status": "ok"` and `"service": "atreides-gateway"`.

Trigger the safe attack fixture:

```bash
curl -X POST http://localhost:4100/v1/demo/indirect-prompt-injection
```

Expected: `receipt.decision` is `block`; `receipt.policy` is `atreides/no-untrusted-secret-egress`; `receipt.hash` is a 64-character hexadecimal SHA-256 digest. The fixture only refers to `.invalid` and fake data.

Inspect the ledger:

```bash
curl http://localhost:4100/v1/receipts
```

Open `http://localhost:3000` and verify the product page renders.

## Container verification

Docker Compose requires a running Docker daemon. Confirm `docker version` returns both client and server information before continuing; if it reports that it cannot connect to the daemon, start Docker Desktop (or the relevant Docker service) and rerun the command.

```bash
docker compose up --build
```

In a new terminal, repeat the gateway health and fixture requests above. The compose stack exposes web on port 3000 and gateway on port 4100. Stop it with `docker compose down`.

## Pre-public-repo checklist

- [ ] `git status` contains no `.env`, tokens, local logs, caches, or `node_modules`.
- [ ] All fixture data remains fake; no endpoint other than `attacker.invalid` is used in the attack demo.
- [ ] README quick start matches tested commands on a clean clone.
- [ ] Gateway test, root typecheck, and web build pass on the final commit.
- [ ] Record the exact command output/date in the release or submission notes.
- [ ] Confirm the public deployment does not expose a privileged evaluation endpoint without access controls.

## Deployment boundary

Docker Compose is suitable for the demonstration. A production deployment is out of scope: it would require authenticated clients, transport encryption, persistent encrypted receipts, identity-aware authorization, rate limits, secrets management, and an inline enforcement proxy. Do not represent the current in-memory ledger as durable audit storage.
