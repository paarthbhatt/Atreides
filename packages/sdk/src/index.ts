export type Trust = "trusted" | "external" | "untrusted";
export type Sensitivity = "public" | "internal" | "confidential" | "secret";
export type Action = { tool: string; destination?: string; writes?: boolean; context: { source: string; trust: Trust; sensitivity: Sensitivity; contentHash?: string }[]; actor?: { id: string; role?: string } };
export type Receipt = { id: string; decision: "allow" | "block" | "approval_required"; reason: string; policy: string; policyVersion: string; hash: string; previousHash: string | null };

export function createAtreidesClient(options: { baseUrl?: string; token?: string; fetch?: typeof fetch } = {}) {
  const baseUrl = options.baseUrl ?? "http://localhost:4100";
  const request = options.fetch ?? fetch;
  const headers = { "content-type": "application/json", ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) };
  return {
    async evaluate(action: Action) {
      const response = await request(`${baseUrl}/v1/evaluate`, { method: "POST", headers, body: JSON.stringify(action) });
      if (!response.ok) throw new Error(`Atreides evaluation failed (${response.status}).`);
      return (await response.json() as { receipt: Receipt }).receipt;
    },
    async policy() {
      const response = await request(`${baseUrl}/v1/policy`, { headers });
      if (!response.ok) throw new Error(`Atreides policy request failed (${response.status}).`);
      return response.json();
    },
    async verifyReceipts() {
      const response = await request(`${baseUrl}/v1/receipts?verify=true`, { headers });
      if (!response.ok) throw new Error(`Atreides receipt request failed (${response.status}).`);
      return response.json() as Promise<{ verification: { valid: boolean; receipts: number; failures: string[] } }>;
    },
  };
}
