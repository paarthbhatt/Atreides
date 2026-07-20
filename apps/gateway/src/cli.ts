import { readFileSync } from "node:fs";
import { currentPolicy, verifyReceipts } from "./index.js";
import { loadPolicyBundle } from "./policy.js";
import { connectConfiguredUpstream } from "./upstream.js";

const [command, argument] = process.argv.slice(2);

if (command === "policy" && argument === "show") {
  console.log(JSON.stringify(currentPolicy(), null, 2));
} else if (command === "policy" && argument === "validate") {
  const path = process.argv[4];
  if (!path) throw new Error("Usage: atreides policy validate <policy.json>");
  console.log(JSON.stringify(loadPolicyBundle(path), null, 2));
} else if (command === "receipt" && argument === "verify") {
  console.log(JSON.stringify(verifyReceipts(), null, 2));
} else if (command === "upstream" && argument === "discover") {
  const upstream = await connectConfiguredUpstream();
  if (!upstream) throw new Error("Set ATREIDES_UPSTREAM_COMMAND before discovering upstream tools.");
  try { console.log(JSON.stringify(await upstream.listTools(), null, 2)); } finally { upstream.close(); }
} else if (command === "fixture" && argument === "print") {
  const path = process.argv[4];
  if (!path) throw new Error("Usage: atreides fixture print <action.json>");
  console.log(readFileSync(path, "utf8"));
} else {
  console.log("Atreides CLI\n  policy show\n  policy validate <policy.json>\n  receipt verify\n  upstream discover\n  fixture print <action.json>");
}
