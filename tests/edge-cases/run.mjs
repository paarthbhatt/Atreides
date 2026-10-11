import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("ATREIDES_")));
// Tooling caches are transient and confined to the permitted fixture directory.
// No custom policy, durable user ledger, or external upstream is inherited.
const runtimeDirectory = mkdtempSync(fileURLToPath(new URL("./fixtures/.verification-", import.meta.url)));
process.once("exit", () => rmSync(runtimeDirectory, { recursive: true, force: true }));
environment.TMPDIR = runtimeDirectory;
environment.NODE_DISABLE_COMPILE_CACHE = "1";
environment.TSX_DISABLE_CACHE = "1";
environment.NO_COLOR = "1";
const checks = [
  { name: "workspace tests", command: "npm", args: ["test"] },
  { name: "strict authorization matrix", command: "node_modules/.bin/tsx", args: ["--test", "tests/edge-cases/authz-matrix.test.ts"] },
  { name: "edge-case typecheck", command: "node_modules/.bin/tsc", args: ["-p", "tests/edge-cases/tsconfig.json"] },
  { name: "edge-case lint", command: "node_modules/.bin/eslint", args: ["--config", "apps/gateway/eslint.config.mjs", "tests/edge-cases"] },
  { name: "workspace lint", command: "npm", args: ["run", "lint"] },
  { name: "gateway typecheck", command: "npm", args: ["run", "typecheck", "--workspace=@atreides/gateway"] },
  { name: "SDK typecheck", command: "npm", args: ["run", "typecheck", "--workspace=@atreides/sdk"] },
  { name: "web typecheck (no build-info writes)", command: "npm", args: ["run", "typecheck", "--workspace=@atreides/web", "--", "--incremental", "false"] },
];

async function execute(check) {
  const child = spawn(check.command, check.args, { cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"] });
  const chunks = [];
  let stdout = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); chunks.push(chunk.toString()); });
  child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));
  const result = await new Promise((resolve) => {
    child.on("error", (error) => { chunks.push(`${error.stack}\n`); resolve({ exitCode: 1, signal: null }); });
    child.on("close", (code, signal) => resolve({ exitCode: code ?? 1, signal }));
  });
  return { ...check, ...result, output: chunks.join(""), stdout };
}

const startedAt = new Date().toISOString();
const transcript = [`Atreides authorization edge-case run\nWork order date: 2026-10-11\nStarted: ${startedAt}\nNode: ${process.version}\nPlatform: ${process.platform}/${process.arch}\nRoot: ${root}\n\n`];
const results = [];
let matrix = [];
for (const check of checks) {
  console.log(`Running ${check.name}...`);
  const result = await execute(check);
  results.push({ name: check.name, command: [check.command, ...check.args].join(" "), exitCode: result.exitCode, signal: result.signal });
  transcript.push(`$ ${[check.command, ...check.args].join(" ")}\n${result.output}\nEXIT STATUS: ${result.exitCode}${result.signal ? ` (signal ${result.signal})` : ""}\n\n`);
  if (check.name === "strict authorization matrix") {
    matrix = [...result.stdout.matchAll(/^# AUTHZ_CASE (.+)$/gm)].map((match) => JSON.parse(Buffer.from(match[1], "base64").toString("utf8")));
    const fixtures = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
    if (matrix.length !== fixtures.length || new Set(matrix.map((item) => item.id)).size !== fixtures.length) {
      const error = `Incomplete matrix evidence: ${matrix.length} observations for ${fixtures.length} fixtures.`;
      transcript.push(`${error}\n`);
      results[results.length - 1].exitCode = 1;
      const observations = new Map(matrix.map((item) => [item.id, item]));
      matrix = fixtures.map((fixture) => observations.get(fixture.id) ?? { ...fixture, status: "ERROR", error });
    }
    console.log(`Matrix: ${matrix.filter((item) => item.status === "PASS").length} PASS, ${matrix.filter((item) => item.status === "FAIL").length} FAIL, ${matrix.filter((item) => item.status === "ERROR").length} ERROR`);
  }
  console.log(`${check.name}: exit ${result.exitCode}`);
}
const summary = {
  workOrderDate: "2026-10-11",
  startedAt,
  finishedAt: new Date().toISOString(),
  node: process.version,
  checks: results,
  totals: {
    cases: matrix.length,
    pass: matrix.filter((item) => item.status === "PASS").length,
    fail: matrix.filter((item) => item.status === "FAIL").length,
    error: matrix.filter((item) => item.status === "ERROR").length,
    unexpectedAllows: matrix.filter((item) => item.status === "FAIL" && item.expected === "deny" && item.observed === "allow").length,
  },
  matrix,
};
transcript.push(`SUMMARY\n${JSON.stringify({ checks: summary.checks, totals: summary.totals }, null, 2)}\n`);
writeFileSync(new URL("../reports/authz-test-run.txt", import.meta.url), transcript.join(""));
writeFileSync(new URL("../reports/authz-results.json", import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log("Saved tests/reports/authz-test-run.txt and tests/reports/authz-results.json");
process.exitCode = results.some((item) => item.exitCode !== 0) ? 1 : 0;
