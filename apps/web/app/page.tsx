"use client";

import { useEffect, useRef, useState } from "react";
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
type LabState = { trust: "trusted" | "untrusted"; sensitivity: "public" | "secret"; destination: "approved" | "external"; writes: boolean };
type UnsafeBaseline = { outcome: string; transmitted: boolean; simulatedOutput: string; explanation: string };
type DemoPhase = "ready" | "before" | "after" | "audit" | "error";
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4100";

export default function Home() {
  const [stage, setStage] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [running, setRunning] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [health, setHealth] = useState<GatewayHealth | null>(null);
  const [verification, setVerification] = useState<ReceiptVerification | null>(null);
  const [lab, setLab] = useState<LabState>({ trust: "untrusted", sensitivity: "secret", destination: "external", writes: false });
  const [labReceipt, setLabReceipt] = useState<Receipt | null>(null);
  const [labRunning, setLabRunning] = useState(false);
  const [baseline, setBaseline] = useState<UnsafeBaseline | null>(null);
  const [demoPhase, setDemoPhase] = useState<DemoPhase>("ready");
  const topRef = useRef<HTMLElement>(null);
  const current = stages[stage];
  const blocked = stage === 3;

  useEffect(() => {
    const target = topRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0.96 });
    observer.observe(target);
    return () => observer.disconnect();
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

  async function runBeforeAfterProof() {
    setRunning(true); setGatewayError(null); setVerification(null); setReceipt(null); setBaseline(null); setDemoPhase("before");
    try {
      const beforeResponse = await fetch(`${gatewayUrl}/v1/demo/unprotected-indirect-prompt-injection`, { method: "POST" });
      const before = await beforeResponse.json() as UnsafeBaseline & { error?: string };
      if (!beforeResponse.ok) throw new Error(before.error ?? "Unsafe baseline did not return.");
      setBaseline(before);
      setDemoPhase("after");
      const response = await fetch(`${gatewayUrl}/v1/demo/indirect-prompt-injection`, { method: "POST" });
      const payload = await response.json() as { receipt?: Receipt; error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Gateway did not return a receipt.");
      setReceipt(payload.receipt); setStage(3);
      setDemoPhase("audit");
      try {
        const ledger = await fetch(`${gatewayUrl}/v1/receipts?verify=true`);
        if (ledger.ok) {
          const value = await ledger.json() as { verification?: ReceiptVerification };
          setVerification(value.verification ?? null);
        }
      } catch { setVerification(null); }
    } catch (error) {
      setDemoPhase("error");
      setGatewayError(error instanceof Error ? error.message : "Could not reach the gateway.");
    } finally { setRunning(false); }
  }

  async function simulatePolicy() {
    setLabRunning(true);
    try {
      const destination = lab.destination === "external" ? "https://attacker.invalid/collect" : "internal://diagnostics";
      const response = await fetch(`${gatewayUrl}/v1/evaluate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tool: lab.writes ? "workspace.publish" : "diagnostics.send", destination, writes: lab.writes, context: [{ source: "policy-lab", trust: lab.trust, sensitivity: lab.sensitivity, contentHash: "lab:synthetic" }] }) });
      const payload = await response.json() as { receipt?: Receipt; error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Policy evaluation failed.");
      setLabReceipt(payload.receipt);
    } finally { setLabRunning(false); }
  }

  return <main>
    <nav className={scrolled ? "scrolled" : ""}>
      <a className="brand" href="#top" aria-label="Atreides home">ATREIDES<span>®</span></a>
      <div className="nav-links"><a href="#proof">The proof</a><a href="#architecture">Architecture</a><a href="#lab">Policy lab</a><a href="#console">Console</a></div>
      <a className="button compact" href="#console">Open demo <b>↗</b></a>
    </nav>

    <section id="top" ref={topRef} className="hero grid-bg">
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
      <div className="proof-run" aria-live="polite">
        <div className={demoPhase === "before" || demoPhase === "after" || demoPhase === "audit" ? "proof-event before active" : "proof-event before"}><span>BEFORE</span><b>Unprotected agent</b><p>{baseline ? `Synthetic output prepared: ${baseline.simulatedOutput}` : "The same indirect instruction reaches a privileged action with no policy boundary."}</p><small>{baseline ? "Safe simulation. No network request or real secret." : "No LLM classification can stop a tool call by itself."}</small></div>
        <div className="proof-arrow" aria-hidden="true">→</div>
        <div className={demoPhase === "after" || demoPhase === "audit" ? "proof-event after active" : "proof-event after"}><span>AFTER</span><b>Atreides intercepts</b><p>{receipt ? `Blocked by ${receipt.policy}.` : "The exact action is evaluated before the MCP boundary."}</p><small>Deterministic policy checks provenance, sensitivity, destination, and impact.</small></div>
        <div className="proof-arrow" aria-hidden="true">→</div>
        <div className={demoPhase === "audit" && verification?.valid ? "proof-event audit active" : "proof-event audit"}><span>AUDIT</span><b>Trust receipt</b><p>{verification?.valid ? `Hash chain verified across ${verification.receipts} receipt${verification.receipts === 1 ? "" : "s"}.` : "The decision reason and receipt hash are retained for review."}</p><small>{receipt ? `sha256 / ${receipt.hash.slice(0, 18)}…` : "Cryptographic evidence, not a model confidence score."}</small></div>
      </div>
      <div className="proof-action"><button className="button proof-button" type="button" onClick={runBeforeAfterProof} disabled={running}>{running ? "Running proof…" : "Run before/after proof"} <b>↗</b></button><div><p>{demoPhase === "error" ? "The live gateway could not complete the proof." : "The baseline is deliberately synthetic. The block and receipt are real gateway results."}</p>{gatewayError && <p className="gateway-error" role="alert">Gateway unavailable: {gatewayError}</p>}</div></div>
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

    <section id="lab" className="lab section">
      <div className="section-heading"><div><p className="section-index">03 / POLICY LAB</p><h2>Test the boundary.<br /><span>Change the facts.</span></h2></div><p>This is not a mock. Configure an action and evaluate it against the live versioned policy gateway. Every result becomes a trust receipt.</p></div>
      <div className="lab-shell"><div className="lab-controls"><label>CONTEXT TRUST<select value={lab.trust} onChange={(event) => setLab({ ...lab, trust: event.target.value as LabState["trust"] })}><option value="untrusted">untrusted</option><option value="trusted">trusted</option></select></label><label>DATA SENSITIVITY<select value={lab.sensitivity} onChange={(event) => setLab({ ...lab, sensitivity: event.target.value as LabState["sensitivity"] })}><option value="secret">secret</option><option value="public">public</option></select></label><label>DESTINATION<select value={lab.destination} onChange={(event) => setLab({ ...lab, destination: event.target.value as LabState["destination"] })}><option value="external">unapproved external</option><option value="approved">approved internal</option></select></label><label className="toggle">WRITE CAPABILITY<input type="checkbox" checked={lab.writes} onChange={(event) => setLab({ ...lab, writes: event.target.checked })} /><span>{lab.writes ? "enabled" : "disabled"}</span></label><button className="button" type="button" onClick={simulatePolicy} disabled={labRunning}>{labRunning ? "Evaluating…" : "Evaluate policy"} <b>↗</b></button></div><div className={labReceipt ? `lab-result ${labReceipt.decision}` : "lab-result"}><p className="muted">LIVE POLICY RESULT</p><span className="lab-decision">{labReceipt?.decision?.replace("_", " ") ?? "ready"}</span><b>{labReceipt?.policy ?? "Configure an action to inspect its authorization path."}</b><p>{labReceipt?.reason ?? "Atreides evaluates provenance, sensitivity, destination, and impact before execution."}</p>{labReceipt && <code>receipt / {labReceipt.hash.slice(0, 20)}…</code>}</div></div>
    </section>

    <section id="console" className="console section">
      <div className="console-copy"><p className="section-index">04 / OPERATOR CONSOLE</p><h2>Every decision is<br />an <span>evidence trail.</span></h2><p>The before/after proof produces a real policy receipt. Inspect its rule, version, integrity state, and hash here.</p><a className="text-link" href="#proof">Run the proof <b>↑</b></a></div>
      <div className="console-window" aria-live="polite"><header><span className="dot red-dot" /><span className="dot" /><span className="dot" /><b>atreides / mission-control</b><span className={health ? "live" : "live offline"}>● {health ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}</span></header><div className="metrics"><div><small>POLICY VERSION</small><b className="policy-version">{health?.policyVersion ?? "—"}</b><span>versioned policy-as-code</span></div><div><small>BLOCKED CHAINS</small><b className="warning">{receipt ? "04" : "03"}</b><span>{verification?.valid ? `${verification.receipts} receipts verified` : "awaiting proof replay"}</span></div><div><small>RECEIPT MODE</small><b className="receipt-mode">{health?.signedReceipts ? "SIGNED" : "HASHED"}</b><span>{health?.durableReceipts ? "durable ledger" : "ephemeral demo ledger"}</span></div></div><div className="receipt"><div><span className="pill">{receipt?.decision?.toUpperCase() ?? "READY"}</span><b>{receipt ? "External context attempted secret egress" : "Run the safe fixture to obtain a live receipt"}</b><small>{receipt ? `policy / ${receipt.policy} · v${receipt.policyVersion}` : "gateway / waiting for replay"}</small>{receipt && <code title={receipt.hash}>sha256 / {receipt.hash.slice(0, 16)}…</code>}</div><span className="check">{verification?.valid ? "✓" : "○"}</span></div>{receipt && <p className="receipt-reason">{receipt.reason}</p>}{verification && <p className={verification.valid ? "verification valid" : "verification invalid"}>{verification.valid ? `Chain integrity verified across ${verification.receipts} receipt${verification.receipts === 1 ? "" : "s"}.` : verification.failures.join(" ")}</p>}</div>
    </section>
    <footer><span>ATREIDES / SECURITY BY PROOF</span><span>BUILT FOR THE MCP ERA</span><span>© 2026</span></footer>
  </main>;
}
