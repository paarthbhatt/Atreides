import type { Sensitivity, Trust } from "./index.js";

// Trusted capability registry (F1/F5). A protected capability is identified by
// a stable canonical id, not by its display name. Aliases are recognized only
// when this registry maps them explicitly; an undiscovered or newly introduced
// spelling is never treated as the protected capability. MCP tool names are
// case-sensitive, so aliases are enumerated, never derived by normalization.
type ProtectedCapability = { id: string; scopeGated: boolean; names: string[] };

const PROTECTED_CAPABILITIES: ProtectedCapability[] = [
  {
    id: "filesystem.read_secret",
    scopeGated: true,
    names: ["filesystem.read_secret", "FILESYSTEM.READ_SECRET", "filesystem/../read_secret", "fs.read_secret"],
  },
];

const capabilityByName = new Map<string, ProtectedCapability>();
for (const capability of PROTECTED_CAPABILITIES) {
  for (const name of capability.names) capabilityByName.set(name, capability);
}

export type ResolvedCapability = { id: string; scopeGated: boolean };

export function resolveCapability(toolName: string): ResolvedCapability {
  const capability = capabilityByName.get(toolName);
  return capability ? { id: capability.id, scopeGated: capability.scopeGated } : { id: toolName, scopeGated: false };
}

// Trusted data-classification registry (F7). Sensitivity is a caller assertion;
// a known-sensitive source is reclassified to its real sensitivity so a caller
// cannot downgrade a secret by relabelling it.
const SENSITIVE_SOURCE = /(^|\/)\.env($|\.)/;

export function classifySensitivity(source: string, declared: Sensitivity): Sensitivity {
  return SENSITIVE_SOURCE.test(source) ? "secret" : declared;
}

// Server-attested principals (F7). `trust` is a caller assertion and must be
// bound to a real provenance attestation before it is honored. This registry
// stands in for that provenance service: a `trusted` label from any source not
// listed here is treated as untrusted (fail closed), so an attacker-controlled
// source cannot authorize itself by self-labelling trusted.
const ATTESTED_TRUSTED_SOURCES = new Set(["operator", "user"]);

export function classifyTrust(source: string, declared: Trust): Trust {
  if (declared === "trusted" && !ATTESTED_TRUSTED_SOURCES.has(source)) return "untrusted";
  return declared;
}
