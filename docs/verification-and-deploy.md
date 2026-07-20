# Verification and deploy checklist

## Local verification

From the repository root:

```bash
npm install
npm run typecheck
npm run lint
npm run test --workspace=@atreides/gateway
npm run build --workspace=@atreides/sdk
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

To enable local durable and signed receipts, set the values in `.env.example` in your shell, then run the gateway and verify the resulting chain:

```powershell
$env:ATREIDES_RECEIPT_PATH = ".atreides/receipts.jsonl"
$env:ATREIDES_RECEIPT_SIGNING_KEY = "local-development-only"
npm run cli --workspace=@atreides/gateway -- receipt verify
```

Open `http://localhost:3000` and verify the product page renders.

## Container verification

Docker Compose requires a running Docker daemon. Confirm `docker version` returns both client and server information before continuing; if it reports that it cannot connect to the daemon, start Docker Desktop (or the relevant Docker service) and rerun the command.

```bash
docker compose up --build
```

In a new terminal, repeat the gateway health and fixture requests above. The compose stack exposes web on port 3000 and gateway on port 4100. Stop it with `docker compose down`.

## CI/CD preflight

GitHub Actions runs on every pull request, every push to `main`, and manual dispatch. It installs from the lockfile, lints both workspaces, type-checks, runs the gateway tests, builds the web app, checks for high/critical production dependency advisories, then builds and smoke-tests the Docker Compose stack.

The workflow is deliberately deployment-target-neutral. Configure a protected deployment environment and credentials before adding a deployment job; no external environment is mutated by the current pipeline.

## Pre-public-repo checklist

- [ ] `git status` contains no `.env`, tokens, local logs, caches, or `node_modules`.
- [ ] All fixture data remains fake; no endpoint other than `attacker.invalid` is used in the attack demo.
- [ ] README quick start matches tested commands on a clean clone.
- [ ] Gateway test, root typecheck, and web build pass on the final commit.
- [ ] Record the exact command output/date in the release or submission notes.
- [ ] Configure `ATREIDES_API_TOKEN` before exposing the privileged evaluation endpoints publicly.
- [ ] Configure a non-local receipt store and managed signing key before making auditability claims.

## Deployment boundary

Docker Compose is suitable for the demonstration. The gateway now supports optional bearer authentication, rate limits, local persisted receipts, and HMAC signatures, but a production deployment still needs TLS/mTLS, identity-aware authorization, managed secrets, encrypted append-only storage, observability, and an enforced traffic path. See [production-path.md](production-path.md).
