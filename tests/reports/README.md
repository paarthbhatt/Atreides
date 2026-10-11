# Authorization verification evidence

`authz-test-run.txt` contains the full stdout/stderr and exit status of the
original workspace tests, the strict edge-case matrix, and the type/lint checks.
`authz-results.json` contains one observed outcome per fixture and check status.

Regenerate from the repository root:

```bash
node tests/edge-cases/run.mjs
```

The command returns nonzero if any security assertion or verification check
fails. The dated matrix explains known failures. This report directory is
inside `tests/` to comply with the work order's explicit allowed-path restriction.
