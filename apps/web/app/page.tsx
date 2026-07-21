"use client";

import { useEffect, useRef, useState } from "react";
import { HeroField } from "./HeroField";

const stages = [
  ["01", "External issue", "A malicious README asks an agent to collect diagnostics."],
  ["02", "Sensitive read", "The task reaches a tool capable of reading .env."],
  ["03", "Outbound send", "The agent plans an unapproved external transmission."],
  ["04", "Atreides blocks", "Provenance makes the unsafe authorization path visible."],
] as const;

const flowSteps = [
  {
    id: "01",
    title: "Untrusted content enters",
    label: "SOURCE",
    detail: "A README, issue, webpage, email, or tool result enters the agent workspace with provenance attached.",
  },
  {
    id: "02",
    title: "Agent proposes an action",
    label: "INTENT",
    detail: "The model turns the instruction into a concrete request: tool, destination, data class, and write impact.",
  },
  {
    id: "03",
    title: "Context envelope is built",
    label: "FACTS",
    detail: "Atreides normalizes origin, trust, sensitivity, destination, and content hash into a policy input.",
  },
  {
    id: "04",
    title: "Policy gate evaluates",
    label: "CHECK",
    detail: "Versioned policy decides before execution. Secret data from untrusted provenance cannot approve external egress.",
  },
  {
    id: "05",
    title: "MCP execution is controlled",
    label: "BOUNDARY",
    detail: "Allowed calls continue to the upstream MCP server. Blocked calls stop before the tool can run.",
  },
  {
    id: "06",
    title: "Receipt is emitted",
    label: "EVIDENCE",
    detail: "The decision, reason, policy version, prior hash, and evidence hash are written as a trust receipt.",
  },
  {
    id: "07",
    title: "Audit can replay why",
    label: "AUDIT",
    detail: "Judges and developers can inspect the hash chain to prove what happened and why it was blocked.",
  },
] as const;

type Receipt = { decision: string; reason: string; policy: string; policyVersion: string; hash: string };
type GatewayHealth = { status: string; policyVersion: string; durableReceipts: boolean; signedReceipts: boolean };
type ReceiptVerification = { valid: boolean; receipts: number; failures: string[] };
type LabState = { trust: "trusted" | "untrusted"; sensitivity: "public" | "secret"; destination: "approved" | "external"; writes: boolean };
type UnsafeBaseline = { outcome: string; transmitted: boolean; simulatedOutput: string; explanation: string };
type DemoPhase = "ready" | "before" | "after" | "audit" | "error";
type DemoSource = "idle" | "live" | "offline";
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4100";
const offlineBaseline: UnsafeBaseline = {
  outcome: "offline_presentation_fallback", transmitted: false, simulatedOutput: "DEMO_SECRET=[redacted]",
  explanation: "Offline presentation fallback. No agent, network request, or secret is involved.",
};
const offlineReceipt: Receipt = {
  decision: "block", policy: "atreides/no-untrusted-secret-egress", policyVersion: "offline-demo",
  reason: "Offline presentation fallback: the same policy outcome is shown locally, without a gateway call.", hash: "offline-demo-receipt",
};

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
  const [demoSource, setDemoSource] = useState<DemoSource>("idle");
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState(0);
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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => setFlowStep((value) => (value + 1) % flowSteps.length), 2_700);
    return () => window.clearInterval(interval);
  }, []);

  async function runBeforeAfterProof() {
    let timeout: number | undefined;
    setRunning(true); setGatewayError(null); setDemoNotice(null); setVerification(null); setReceipt(null); setBaseline(null); setDemoPhase("before"); setDemoSource("live");
    try {
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 3_000);
      const beforeResponse = await fetch(`${gatewayUrl}/v1/demo/unprotected-indirect-prompt-injection`, { method: "POST", signal: controller.signal });
      const before = await beforeResponse.json() as UnsafeBaseline & { error?: string };
      if (!beforeResponse.ok) throw new Error(before.error ?? "Unsafe baseline did not return.");
      setBaseline(before);
      setDemoPhase("after");
      const response = await fetch(`${gatewayUrl}/v1/demo/indirect-prompt-injection`, { method: "POST", signal: controller.signal });
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
    } catch {
      setDemoSource("offline"); setBaseline(offlineBaseline); setDemoPhase("before");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 240));
      setDemoPhase("after");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 280));
      setReceipt(offlineReceipt); setVerification(null); setStage(3); setDemoPhase("audit");
      setDemoNotice("Gateway unavailable. Showing the clearly marked offline presentation fallback.");
    } finally { if (timeout) window.clearTimeout(timeout); setRunning(false); }
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
      <div className="nav-links"><a href="#proof">The proof</a><a href="#architecture">Architecture</a><a href="#flow">Workflow</a><a href="#lab">Policy lab</a><a href="#console">Console</a></div>
      <a className="button compact" href="#console">Open demo <b>↗</b></a>
    </nav>

    <section id="top" ref={topRef} className="hero grid-bg">
      <div className="hero-aurora" aria-hidden="true" />
      <div className="eyebrow"><i /> MCP SECURITY GATEWAY <em>LOCAL DEMO</em></div>
      <div className="hero-copy">
        <p className="kicker">TRUST THE AGENT.<br /><strong>VERIFY THE ACTION.</strong></p>
        <h1>Language becomes authority.<br />Atreides makes it <strong>enforceable.</strong></h1>
        <p className="lede">A proof-carrying security gateway for MCP agents. Discover the path from untrusted context to sensitive action, enforce policy at the boundary, and retain a verifiable decision receipt.</p>
        <div className="actions"><a className="button" href="#proof">Trace an attack <b>↓</b></a><a className="text-link" href="#architecture">Explore the system <b>→</b></a></div>
      </div>
      <HeroField />
      <div className="orbit" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="node n1" /><div className="node n2" /><div className="node n3" /><div className="threat-line" /><div className="orbit-label top-label">UNTRUSTED<br />CONTEXT</div><div className="orbit-label right-label">MCP<br />ACTION</div><div className="orbit-label bottom-label">POLICY<br />BOUNDARY</div></div>
      <div className="hero-foot"><span>PROMPT INJECTION</span><i className="scroll-mark" /><span>PROVENANCE-FIRST ENFORCEMENT</span></div>
    </section>

    <section id="proof" className="proof section">
      <div className="section-heading"><div><p className="section-index">01 / ATTACK REPLAY</p><h2>One unsafe instruction.<br /><span>One observable chain.</span></h2></div><p>Atreides sees more than a prompt. It tracks origin, sensitivity, tool capability, destination, and policy before an action crosses the MCP boundary.</p></div>
      <div className="replay">
        <div className="replay-steps">{stages.map(([id, title], index) => <button key={id} className={index === stage ? "active" : ""} onClick={() => setStage(index)} aria-pressed={index === stage}><span>{id}</span><b>{title}</b><i /></button>)}</div>
        <div className="terminal-card">
          <header><span className={blocked ? "status blocked" : "status"}>{blocked ? "BLOCKED" : "OBSERVED"}</span><span>trace_47a9</span></header>
          <div className="terminal-content"><p className="muted">{current[0]} / {current[1].toUpperCase()}</p><h3>{current[2]}</h3><div className="code-line"><span>source.trust</span><b className="red">external / untrusted</b></div><div className="code-line"><span>requested.tool</span><b>diagnostics.send</b></div><div className="code-line"><span>data.label</span><b className="amber">secret</b></div><div className="decision"><span>{blocked ? "DENY" : "EVALUATE"}</span><p>{blocked ? "External provenance cannot authorize secret transmission." : "Tracing capability and provenance before execution."}</p></div></div>
          <div className="mini-flow" aria-label={`Replay progress: ${current[1]}`}>
            {stages.map(([id, title], index) => <div key={id} className={index < stage ? "mini-step complete" : index === stage ? "mini-step current" : "mini-step"}><span>{id}</span><b>{title}</b></div>)}
          </div>
          <footer><span>RECEIPT {blocked ? "e8d7…1af0" : "PENDING"}</span><span>SHA-256 CHAINED</span></footer>
        </div>
      </div>
      <div className="proof-run" aria-live="polite">
        <div className={demoPhase === "before" || demoPhase === "after" || demoPhase === "audit" ? "proof-event before active" : "proof-event before"}><span>BEFORE</span><b>Unprotected agent</b><p>{baseline ? `Synthetic output prepared: ${baseline.simulatedOutput}` : "The same indirect instruction reaches a privileged action with no policy boundary."}</p><small>{baseline ? "Safe simulation. No network request or real secret." : "No LLM classification can stop a tool call by itself."}</small></div>
        <div className="proof-arrow" aria-hidden="true">→</div>
        <div className={demoPhase === "after" || demoPhase === "audit" ? "proof-event after active" : "proof-event after"}><span>AFTER</span><b>{demoSource === "offline" ? "Offline demo block" : "Atreides intercepts"}</b><p>{receipt ? demoSource === "offline" ? "Synthetic fallback shown. No gateway decision was requested." : `Blocked by ${receipt.policy}.` : "The exact action is evaluated before the MCP boundary."}</p><small>{demoSource === "offline" ? "Presentation continuity only. Deploy the gateway for enforcement evidence." : "Deterministic policy checks provenance, sensitivity, destination, and impact."}</small></div>
        <div className="proof-arrow" aria-hidden="true">→</div>
        <div className={demoPhase === "audit" && (verification?.valid || demoSource === "offline") ? "proof-event audit active" : "proof-event audit"}><span>AUDIT</span><b>{demoSource === "offline" ? "Demo receipt" : "Trust receipt"}</b><p>{demoSource === "offline" ? "This local fallback is not a hash-chained gateway receipt." : verification?.valid ? `Hash chain verified across ${verification.receipts} receipt${verification.receipts === 1 ? "" : "s"}.` : "The decision reason and receipt hash are retained for review."}</p><small>{demoSource === "offline" ? "Connect the gateway to produce verifiable evidence." : receipt ? `sha256 / ${receipt.hash.slice(0, 18)}…` : "Cryptographic evidence, not a model confidence score."}</small></div>
      </div>
      <div className="proof-action"><button className="button proof-button" type="button" onClick={runBeforeAfterProof} disabled={running}>{running ? "Running proof…" : demoSource === "offline" ? "Retry live proof" : "Run before/after proof"} <b>↗</b></button><div><p>{demoSource === "offline" ? "The gateway was unreachable, so the presentation is using a disclosed local fallback." : "The baseline is deliberately synthetic. The block and receipt are real gateway results."}</p>{demoNotice && <p className="demo-notice" role="status">{demoNotice}</p>}{gatewayError && <p className="gateway-error" role="alert">Gateway unavailable: {gatewayError}</p>}</div></div>
      <p className="replay-caption"><span /> Each frame is an auditable transition, not a model guess.</p>
    </section>

    <section id="architecture" className="architecture section grid-bg">
      <div className="section-heading"><div><p className="section-index">02 / THE DIFFERENCE</p><h2>Policy follows<br /><span>provenance.</span></h2></div><p>Detection asks whether a phrase looks dangerous. Atreides asks whether untrusted context is authorizing a risky capability and makes its decision deterministic.</p></div>
      <div className="system" aria-label="Atreides policy flow">
        <div className="system-node"><small>01</small><b>Context envelope</b><span>Origin · trust · sensitivity · hash</span></div><div className="wire">→</div>
        <div className="system-node"><small>02</small><b>Action graph</b><span>Task · tool · destination · asset</span></div><div className="wire">→</div>
        <div className="system-node decisive"><small>03</small><b>Policy decision</b><span>Allow · block · approval required</span></div><div className="wire">→</div>
        <div className="system-node"><small>04</small><b>Trust receipt</b><span>Explanation · policy · hash chain</span></div>
      </div>
      <div className="principles"><p><span>01</span>Policy is deterministic.</p><p><span>02</span>Evidence is portable.</p><p><span>03</span>Enforcement is upstream-aware.</p></div>
    </section>

    <section id="flow" className="flow-explainer section">
      <div className="section-heading"><div><p className="section-index">03 / WORKFLOW</p><h2>From prompt injection<br /><span>to provable block.</span></h2></div><p>This is the complete control path. The model may still see the malicious instruction, but Atreides governs the tool boundary before anything leaves.</p></div>
      <div className={`workflow-board step-${flowStep + 1}`} aria-label="Animated start-to-finish Atreides workflow">
        <div className="workflow-lane" aria-hidden="true">
          <span className="lane-segment risk" />
          <span className="lane-segment governed" />
          <span className="lane-segment audit" />
          <span className="request-packet"><b>request</b></span>
          <span className="blocked-egress">blocked egress</span>
          <span className="receipt-packet">receipt</span>
        </div>
        <div className="workflow-map">
          {flowSteps.map((step, index) => <button key={step.id} type="button" className={index === flowStep ? "workflow-node active" : index < flowStep ? "workflow-node complete" : "workflow-node"} onClick={() => setFlowStep(index)} aria-pressed={index === flowStep}>
            <span>{step.id}</span>
            <small>{step.label}</small>
            <b>{step.title}</b>
          </button>)}
        </div>
        <div className="workflow-detail">
          <div className="workflow-core" aria-hidden="true">
            <span className="core-ring" />
            <span className="core-scan" />
            <div className="policy-prism">
              <span className="prism-face prism-front">POLICY</span>
              <span className="prism-face prism-back">HASH</span>
              <span className="prism-face prism-right">BLOCK</span>
              <span className="prism-face prism-left">FACTS</span>
              <span className="prism-face prism-top">MCP</span>
              <span className="prism-face prism-bottom">AUDIT</span>
            </div>
            <b>ATREIDES</b>
            <small>{flowSteps[flowStep].label}</small>
          </div>
          <article>
            <span>{flowSteps[flowStep].id} / {flowSteps[flowStep].label}</span>
            <h3>{flowSteps[flowStep].title}</h3>
            <p>{flowSteps[flowStep].detail}</p>
          </article>
        </div>
        <div className="workflow-ledger" aria-hidden="true">
          <span>source: issue #47</span>
          <span>trust: untrusted</span>
          <span>data: secret</span>
          <span>destination: external</span>
          <span>decision: block</span>
          <span>receipt: sha256 chained</span>
        </div>
      </div>
      <p className="flow-caption"><span /> Click any step to scrub the workflow. Autoplay pauses for reduced-motion users.</p>
    </section>

    <section id="lab" className="lab section">
      <div className="section-heading"><div><p className="section-index">04 / POLICY LAB</p><h2>Test the boundary.<br /><span>Change the facts.</span></h2></div><p>This is not a mock. Configure an action and evaluate it against the live versioned policy gateway. Every result becomes a trust receipt.</p></div>
      <div className="lab-shell"><div className="lab-controls"><label>CONTEXT TRUST<select value={lab.trust} onChange={(event) => setLab({ ...lab, trust: event.target.value as LabState["trust"] })}><option value="untrusted">untrusted</option><option value="trusted">trusted</option></select></label><label>DATA SENSITIVITY<select value={lab.sensitivity} onChange={(event) => setLab({ ...lab, sensitivity: event.target.value as LabState["sensitivity"] })}><option value="secret">secret</option><option value="public">public</option></select></label><label>DESTINATION<select value={lab.destination} onChange={(event) => setLab({ ...lab, destination: event.target.value as LabState["destination"] })}><option value="external">unapproved external</option><option value="approved">approved internal</option></select></label><label className="toggle">WRITE CAPABILITY<input type="checkbox" checked={lab.writes} onChange={(event) => setLab({ ...lab, writes: event.target.checked })} /><span>{lab.writes ? "enabled" : "disabled"}</span></label><button className="button" type="button" onClick={simulatePolicy} disabled={labRunning}>{labRunning ? "Evaluating…" : "Evaluate policy"} <b>↗</b></button></div><div className={labReceipt ? `lab-result ${labReceipt.decision}` : "lab-result"}><p className="muted">LIVE POLICY RESULT</p><span className="lab-decision">{labReceipt?.decision?.replace("_", " ") ?? "ready"}</span><b>{labReceipt?.policy ?? "Configure an action to inspect its authorization path."}</b><p>{labReceipt?.reason ?? "Atreides evaluates provenance, sensitivity, destination, and impact before execution."}</p>{labReceipt && <code>receipt / {labReceipt.hash.slice(0, 20)}…</code>}</div></div>
    </section>

    <section id="console" className="console section">
      <div className="console-copy"><p className="section-index">05 / OPERATOR CONSOLE</p><h2>Every decision is<br />an <span>evidence trail.</span></h2><p>{demoSource === "offline" ? "The presentation is showing a disclosed local result. Connect the gateway to inspect a live, verifiable receipt." : "The before/after proof produces a real policy receipt. Inspect its rule, version, integrity state, and hash here."}</p><a className="text-link" href="#proof">Run the proof <b>↑</b></a></div>
      <div className="console-window" aria-live="polite"><header><span className="dot red-dot" /><span className="dot" /><span className="dot" /><b>atreides / mission-control</b><span className={demoSource === "offline" ? "live demo" : health ? "live" : "live offline"}>● {demoSource === "offline" ? "OFFLINE DEMO" : health ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}</span></header><div className="metrics"><div><small>POLICY VERSION</small><b className="policy-version">{demoSource === "offline" ? offlineReceipt.policyVersion : health?.policyVersion ?? "WAITING"}</b><span>{demoSource === "offline" ? "local presentation result" : "versioned policy-as-code"}</span></div><div><small>BLOCKED CHAINS</small><b className="warning">{demoSource === "offline" ? "LOCAL" : receipt ? "04" : "03"}</b><span>{demoSource === "offline" ? "no gateway ledger" : verification?.valid ? `${verification.receipts} receipts verified` : "awaiting proof replay"}</span></div><div><small>RECEIPT MODE</small><b className="receipt-mode">{demoSource === "offline" ? "DEMO" : health?.signedReceipts ? "SIGNED" : "HASHED"}</b><span>{demoSource === "offline" ? "not evidence" : health?.durableReceipts ? "durable ledger" : "ephemeral demo ledger"}</span></div></div><div className={demoSource === "offline" ? "receipt demo-receipt" : "receipt"}><div><span className="pill">{receipt?.decision?.toUpperCase() ?? "READY"}</span><b>{receipt ? demoSource === "offline" ? "Synthetic policy response. Not gateway evidence." : "External context attempted secret egress" : "Run the safe fixture to obtain a live receipt"}</b><small>{receipt ? `policy / ${receipt.policy} · v${receipt.policyVersion}` : "gateway / waiting for replay"}</small>{receipt && <code title={receipt.hash}>{demoSource === "offline" ? "demo" : "sha256"} / {receipt.hash.slice(0, 16)}…</code>}</div><span className="check">{demoSource === "offline" ? "△" : verification?.valid ? "✓" : "○"}</span></div>{receipt && <p className="receipt-reason">{receipt.reason}</p>}{demoSource === "offline" ? <p className="verification demo" role="status">Offline demo receipt. It is not generated by the gateway and has no verified ledger chain.</p> : verification && <p className={verification.valid ? "verification valid" : "verification invalid"}>{verification.valid ? `Chain integrity verified across ${verification.receipts} receipt${verification.receipts === 1 ? "" : "s"}.` : verification.failures.join(" ")}</p>}</div>
    </section>
    <footer><span>ATREIDES / SECURITY BY PROOF</span><span>BUILT FOR THE MCP ERA</span><span>© 2026</span></footer>
  </main>;
}
