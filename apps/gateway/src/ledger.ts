import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Receipt } from "./index.js";

export type ReceiptSignature = { algorithm: "hmac-sha256"; keyId: string; value: string };
export type SignedReceipt = Receipt & { signature?: ReceiptSignature };
export type ReceiptLedgerOptions = { path?: string; signingKey?: string; signingKeyId?: string };

function receiptPayload(receipt: SignedReceipt) {
  const { hash: _hash, signature: _signature, ...payload } = receipt;
  void _hash; void _signature;
  return payload;
}

export function hashReceipt(receipt: SignedReceipt): string {
  return createHash("sha256").update(JSON.stringify(receiptPayload(receipt))).digest("hex");
}

export class ReceiptLedger {
  private readonly receipts: SignedReceipt[] = [];
  private readonly path?: string;
  private readonly signingKey?: string;
  private readonly signingKeyId: string;

  constructor(options: ReceiptLedgerOptions = {}) {
    this.path = options.path;
    this.signingKey = options.signingKey;
    this.signingKeyId = options.signingKeyId ?? "local-dev";
    if (this.path && existsSync(this.path)) {
      for (const line of readFileSync(this.path, "utf8").split("\n")) if (line.trim()) this.receipts.push(JSON.parse(line) as SignedReceipt);
    }
  }

  get previousHash() { return this.receipts.at(-1)?.hash ?? null; }
  list() { return [...this.receipts]; }

  sign(hash: string): ReceiptSignature | undefined {
    if (!this.signingKey) return undefined;
    return { algorithm: "hmac-sha256", keyId: this.signingKeyId, value: createHmac("sha256", this.signingKey).update(hash).digest("hex") };
  }

  append(receipt: SignedReceipt) {
    this.receipts.push(receipt);
    if (this.path) {
      mkdirSync(dirname(this.path), { recursive: true });
      appendFileSync(this.path, `${JSON.stringify(receipt)}\n`, { encoding: "utf8", mode: 0o600 });
    }
  }

  verify() {
    let previousHash: string | null = null;
    const failures: string[] = [];
    for (const receipt of this.receipts) {
      if (receipt.previousHash !== previousHash) failures.push(`${receipt.id}: previous hash mismatch`);
      if (hashReceipt(receipt) !== receipt.hash) failures.push(`${receipt.id}: receipt hash mismatch`);
      if (receipt.signature && this.signingKey) {
        const expected = this.sign(receipt.hash)?.value ?? "";
        const received = receipt.signature.value;
        if (expected.length !== received.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(received))) failures.push(`${receipt.id}: signature mismatch`);
      }
      previousHash = receipt.hash;
    }
    return { valid: failures.length === 0, receipts: this.receipts.length, failures };
  }
}
