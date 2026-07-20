"use client";

import { useEffect, useState } from "react";
import { HeroField } from "./HeroField";

const stages = [
  ["01", "External issue", "A malicious README asks an agent to collect diagnostics."],
  ["02", "Sensitive read", "The task reaches a tool capable of reading .env."],
  ["03", "Outbound send", "The agent plans an unapproved external transmission."],
  ["04", "Atreides blocks", "Provenance makes the unsafe authorization path visible."],
] as const;

type Receipt = { decision: string; reason: string; policy: string; policyVersion: string; hash: string };
type GatewayHealth = { status: string; policyVersion: string; durableReceipts: boolean; signedReceipts: boolean };
type ReceiptVerification = { valid: boolean; receipts: number; failures: string[] };
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4100";

export default function Home() {
  const [stage, setStage] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [running, setRunning] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [verification, setVerification] = useState<ReceiptVerification | null>(null);
  const current = stages[stage];
  const blocked = stage === 3;

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update(); window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${gatewayUrl}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Gateway health check failed.");
        setHealth(await response.json() as GatewayHealth);
      })
      .catch(() => setHealth(null));
    return () => controller.abort();
  }, []);

  async function runSafeAttack() {
    setRunning(true); setGatewayError(null);
    try {
      const response = await fetch(`${gatewayUrl}/v1/demo/indirect-prompt-injection`, { method: "POST" });
      const payload = await response.json() as { receipt?: Receipt; error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Gateway did not return a receipt.");
      setReceipt(payload.receipt); setStage(3);
      try {
        const ledger = await fetch(`${gatewayUrl}/v1/receipts?verify=true`);
        if (ledger.ok) {
          const value = await ledger.json() as { verification?: ReceiptVerification };
          setVerification(value.verification ?? null);
        }
      } catch { setVerification(null); }
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : "Could not reach the gateway.");
    } finally { setRunning(false); }
  }

  return <main>
    <nav className={scrolled ? "scrolled" : ""}>
      <a className="brand" href="#top" aria-label="Atreides home">ATREIDES<span>®</span></a>
      <div className="nav-links"><a href="#proof">The proof</a><a href="#architecture">Architecture</a><a href="#console">Console</a></div>
      <a className="button compact" href="#console">Open demo <b>↗</b></a>
    </nav>

    <section id="top" className="hero grid-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="eyebrow"><i /> MCP SECURITY GATEWAY <em>V0.1 / LOCAL DEMO</em></div>
      <div className="hero-copy">
        <p className="kicker">TRUST THE AGENT.<br /><strong>VERIFY THE ACTION.</strong></p>
        <h1>Language becomes authority.<br />Atreides makes it <strong>enforceable.</strong></h1>
        <p className="lede">A proof-carrying security gateway for MCP agents. Discover the path from untrusted context to sensitive action, enforce policy at the boundary, and retain a verifiable decision receipt.</p>
        <div className="actions"><a className="button" href="#proof">Trace an attack <b>↓</b></a><a className="text-link" href="#architecture">Explore the system <b>→</b></a></div>
      </div>
      <HeroField />
      <div className="orbit" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="node n1" /><div className="node n2" /><div className="node n3" /><div className="threat-line" /><div className="orbit-label top-label">UNTRUSTED<br />CONTEXT</div><div className="orbit-label right-label">MCP<br />ACTION</div><div className="orbit-label bottom-label">POLICY<br />BOUNDARY</div></div>
      <div className="hero-foot"><span>SCROLL TO TRACE AN ATTACK</span><i className="scroll-mark" /><span>PROVENANCE-FIRST ENFORCEMENT</span></div>
    </section>

    <section id="proof" className="proof section">
      <div className="section-heading"><div><p className="section-index">01 / ATTACK REPLAY</p><h2>One unsafe instruction.<br /><span>One observable chain.</span></h2></div><p>Atreides sees more than a prompt. It tracks origin, sensitivity, tool capability, destination, and policy before an action crosses the MCP boundary.</p></div>
      <div className="replay">
        <div className="replay-steps">{stages.map(([id, title], index) => <button key={id} className={index === stage ? "active" : ""} onClick={() => setStage(index)} aria-pressed={index === stage}><span>{id}</span><b>{title}</b><i /></button>)}</div>
        <div className="terminal-card">
          <header><span className={blocked ? "status blocked" : "status"}>{blocked ? "BLOCKED" : "OBSERVED"}</span><span>trace_47a9</span></header>
          <div className="terminal-content"><p className="muted">{current[0]} / {current[1].toUpperCase()}</p><h3>{current[2]}</h3><div className="code-line"><span>source.trust</span><b className="red">external / untrusted</b></div><div className="code-line"><span>requested.tool</span><b>diagnostics.send</b></div><div className="code-line"><span>data.label</span><b className="amber">secret</b></div><div className="decision"><span>{blocked ? "DENY" : "EVALUATE"}</span><p>{blocked ? "External provenance cannot authorize secret transmission." : "Tracing capability and provenance before execution."}</p></div></div>
          <footer><span>RECEIPT {blocked ? "e8d7…1af0" : "PENDING"}</span><span>SHA-256 CHAINED</span></footer>
        </div>
      </div>
      <p className="replay-caption"><span /> Each frame is an auditable transition—not a model guess.</p>
    </section>

    <section id="architecture" className="architecture section grid-bg">
      <div className="section-heading"><div><p className="section-index">02 / THE DIFFERENCE</p><h2>Policy follows<br /><span>provenance.</span></h2></div><p>Detection asks whether a phrase looks dangerous. Atreides asks whether untrusted context is authorizing a risky capability—and makes its decision deterministic.</p></div>
      <div className="system" aria-label="Atreides policy flow">
        <div className="system-node"><small>01</small><b>Context envelope</b><span>Origin · trust · sensitivity · hash</span></div><div className="wire">→</div>
        <div className="system-node"><small>02</small><b>Action graph</b><span>Task · tool · destination · asset</span></div><div className="wire">→</div>
        <div className="system-node decisive"><small>03</small><b>Policy decision</b><span>Allow · block · approval required</span></div><div className="wire">→</div>
        <div className="system-node"><small>04</small><b>Trust receipt</b><span>Explanation · policy · hash chain</span></div>
      </div>
      <div className="principles"><p><span>01</span>Policy is deterministic.</p><p><span>02</span>Evidence is portable.</p><p><span>03</span>Enforcement is upstream-aware.</p></div>
    </section>

    <section id="console" className="console section">
      <div className="console-copy"><p className="section-index">03 / OPERATOR CONSOLE</p><h2>Every decision is<br />an <span>evidence trail.</span></h2><p>Replay an attempted exploit against the live gateway. Atreides returns an actual policy receipt, with a hash you can inspect.</p><button className="button demo-button" type="button" onClick={runSafeAttack} disabled={running}>{running ? "Running safe attack…" : "Run safe attack"} <b>↗</b></button>{gatewayError && <p className="gateway-error" role="alert">Gateway unavailable: {gatewayError}</p>}</div>
      <div className="console-window" aria-live="polite"><header><span className="dot red-dot" /><span className="dot" /><span className="dot" /><b>atreides / mission-control</b><span className={health ? "live" : "live offline"}>● {health ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}</span></header><div className="metrics"><div><small>POLICY VERSION</small><b className="policy-version">{health?.policyVersion ?? "—"}</b><span>versioned policy-as-code</span></div><div><small>BLOCKED CHAINS</small><b className="warning">{receipt ? "04" : "03"}</b><span>{verification?.valid ? `${verification.receipts} receipts verified` : "awaiting proof replay"}</span></div><div><small>RECEIPT MODE</small><b className="receipt-mode">{health?.signedReceipts ? "SIGNED" : "HASHED"}</b><span>{health?.durableReceipts ? "durable ledger" : "ephemeral demo ledger"}</span></div></div><div className="receipt"><div><span className="pill">{receipt?.decision?.toUpperCase() ?? "READY"}</span><b>{receipt ? "External context attempted secret egress" : "Run the safe fixture to obtain a live receipt"}</b><small>{receipt ? `policy / ${receipt.policy} · v${receipt.policyVersion}` : "gateway / waiting for replay"}</small>{receipt && <code title={receipt.hash}>sha256 / {receipt.hash.slice(0, 16)}…</code>}</div><span className="check">{verification?.valid ? "✓" : "○"}</span></div>{receipt && <p className="receipt-reason">{receipt.reason}</p>}{verification && <p className={verification.valid ? "verification valid" : "verification invalid"}>{verification.valid ? `Chain integrity verified across ${verification.receipts} receipt${verification.receipts === 1 ? "" : "s"}.` : verification.failures.join(" ")}</p>}</div>
    </section>
    <footer><span>ATREIDES / SECURITY BY PROOF</span><span>BUILT FOR THE MCP ERA</span><span>© 2026</span></footer>
  </main>;
}
