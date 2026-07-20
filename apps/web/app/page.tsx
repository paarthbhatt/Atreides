"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { HeroField } from "./HeroField";

const stages = [
  ["01", "External issue", "A malicious README asks an agent to collect diagnostics."],
  ["02", "Sensitive read", "The task reaches a tool capable of reading .env."],
  ["03", "Outbound send", "The agent plans an unapproved external transmission."],
  ["04", "Atreides blocks", "Provenance makes the unsafe authorization path visible."],
];

type Receipt = { decision: string; reason: string; policy: string; hash: string };
const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4100";

function useScrollProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const element = ref.current;
      if (!element) return;
      const viewport = window.innerHeight;
      const travel = Math.max(element.offsetHeight - viewport * 0.55, 1);
      const next = Math.min(1, Math.max(0, (viewport * 0.65 - element.getBoundingClientRect().top) / travel));
      setProgress((current) => Math.abs(current - next) > 0.002 ? next : current);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    schedule(); window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [ref]);
  return progress;
}

export default function Home() {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [running, setRunning] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const replayFlowRef = useRef<HTMLDivElement>(null);
  const architectureFlowRef = useRef<HTMLDivElement>(null);
  const replayProgress = useScrollProgress(replayFlowRef);
  const architectureProgress = useScrollProgress(architectureFlowRef);
  const stage = receipt ? stages.length - 1 : Math.min(stages.length - 1, Math.floor(replayProgress * stages.length));
  const architectureStage = Math.min(stages.length - 1, Math.floor(architectureProgress * stages.length));
  const current = stages[stage];
  const blocked = stage === 3;
  const replayStyle = { "--progress": replayProgress } as CSSProperties;
  const architectureStyle = { "--architecture-progress": architectureProgress } as CSSProperties;
  function focusReplayStage(index: number) {
    const element = replayFlowRef.current;
    if (!element) return;
    const viewport = window.innerHeight;
    const travel = Math.max(element.offsetHeight - viewport * 0.55, 1);
    window.scrollTo({ top: element.offsetTop - viewport * 0.65 + travel * ((index + 0.15) / stages.length), behavior: "smooth" });
  }
  async function runSafeAttack() {
    setRunning(true); setGatewayError(null);
    try {
      const response = await fetch(`${gatewayUrl}/v1/demo/indirect-prompt-injection`, { method: "POST" });
      const payload = await response.json() as { receipt?: Receipt; error?: string };
      if (!response.ok || !payload.receipt) throw new Error(payload.error ?? "Gateway did not return a receipt.");
      setReceipt(payload.receipt);
    } catch (error) {
      setGatewayError(error instanceof Error ? error.message : "Could not reach the gateway.");
    } finally { setRunning(false); }
  }
  return <main>
    <nav><a className="brand" href="#top">ATREIDES<span>®</span></a><div className="nav-links"><a href="#proof">The proof</a><a href="#architecture">Architecture</a><a href="#console">Console</a></div><a className="button compact" href="#console">Open demo <b>↗</b></a></nav>
    <section id="top" className="hero grid-bg">
      <div className="eyebrow"><i /> MCP SECURITY GATEWAY <em>V0.1 / LOCAL DEMO</em></div>
      <div className="hero-copy"><p className="kicker">TRUST THE AGENT.<br /><strong>VERIFY THE ACTION.</strong></p><h1>Language becomes authority.<br />Atreides makes it enforceable.</h1><p className="lede">A proof-carrying security gateway for MCP agents. Discover the path from untrusted context to sensitive action, enforce policy at the boundary, and retain a verifiable decision receipt.</p><div className="actions"><a className="button" href="#proof">Watch the attack replay <b>↓</b></a><a className="text-link" href="#architecture">Explore the system <b>→</b></a></div></div>
      <HeroField /><div className="orbit" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="node n1" /><div className="node n2" /><div className="node n3" /><div className="threat-line" /><div className="orbit-label top-label">UNTRUSTED<br />CONTEXT</div><div className="orbit-label right-label">MCP<br />ACTION</div><div className="orbit-label bottom-label">POLICY<br />BOUNDARY</div></div>
      <div className="hero-foot"><span>SCROLL TO TRACE AN ATTACK</span><i className="scroll-mark" /><span>PROVENANCE-FIRST ENFORCEMENT</span></div>
    </section>
    <section id="proof" className="proof section"><div className="section-heading"><div><p className="section-index">01 / ATTACK REPLAY</p><h2>One unsafe instruction.<br /><span>One observable chain.</span></h2></div><p>Atreides sees more than a prompt. It tracks origin, sensitivity, tool capability, destination, and policy before an action crosses the MCP boundary.</p></div>
      <div ref={replayFlowRef} className="proof-flow"><div className="story-progress"><span>SCROLL-DRIVEN TRACE</span><b>{String(Math.round(replayProgress * 100)).padStart(2, "0")}%</b></div><div className="replay" style={replayStyle}><div className="replay-steps"><div className="replay-rail" aria-hidden="true"><i /></div>{stages.map(([id, title], index) => <button key={id} className={index === stage ? "active" : index < stage ? "complete" : ""} onClick={() => focusReplayStage(index)} aria-current={index === stage ? "step" : undefined}><span>{id}</span><b>{title}</b><i /></button>)}</div><div className="terminal-card"><header><span className={blocked ? "status blocked" : "status"}>{blocked ? "BLOCKED" : "OBSERVED"}</span><span>trace_47a9</span></header><div className="terminal-content"><p className="muted">{current[0]} / {current[1].toUpperCase()}</p><h3>{current[2]}</h3><div className="code-line"><span>source.trust</span><b className="red">external / untrusted</b></div><div className="code-line"><span>requested.tool</span><b>diagnostics.send</b></div><div className="code-line"><span>data.label</span><b className="amber">secret</b></div><div className="decision"><span>{blocked ? "DENY" : "EVALUATE"}</span><p>{blocked ? "External provenance cannot authorize secret transmission." : "Tracing capability and provenance before execution."}</p></div></div><footer><span>RECEIPT {blocked ? "e8d7…1af0" : "PENDING"}</span><span>SHA-256 CHAINED</span></footer></div></div></div>
    </section>
    <section id="architecture" className="architecture section grid-bg"><div className="section-heading"><div><p className="section-index">02 / THE DIFFERENCE</p><h2>Policy follows<br /><span>provenance.</span></h2></div><p>Detection asks whether a phrase looks dangerous. Atreides asks whether untrusted context is authorizing a risky capability—and makes its decision deterministic.</p></div><div ref={architectureFlowRef} className="architecture-flow"><div className="architecture-status"><span>SCROLL-DRIVEN ACTION GRAPH</span><b>→ {String(architectureStage + 1).padStart(2, "0")} / 04</b></div><div className="system-viewport"><div className="system" style={architectureStyle}>{["Context envelope", "Action graph", "Policy decision", "Trust receipt"].map((label, index) => <Fragment key={label}><div className={`system-node ${index === 2 ? "decisive" : ""} ${index <= architectureStage ? "active" : ""}`}><small>0{index + 1}</small><b>{label}</b><span>{["Origin · trust · sensitivity · hash", "Task · tool · destination · asset", "Allow · block · approval required", "Explanation · policy · hash chain"][index]}</span></div>{index < 3 && <div className={`wire ${index < architectureStage ? "active" : ""}`}>→</div>}</Fragment>)}</div></div></div></section>
    <section id="console" className="console section"><div className="console-copy"><p className="section-index">03 / OPERATOR CONSOLE</p><h2>Every decision is<br />an <span>evidence trail.</span></h2><p>Replay an attempted exploit against the live gateway. Atreides returns an actual policy receipt, with a hash you can inspect.</p><button className="button demo-button" type="button" onClick={runSafeAttack} disabled={running}>{running ? "Running safe attack…" : "Run safe attack"} <b>↗</b></button>{gatewayError && <p className="gateway-error" role="alert">Gateway unavailable: {gatewayError}</p>}</div><div className="console-window" aria-live="polite"><header><span className="dot red-dot" /><span className="dot" /><span className="dot" /><b>atreides / mission-control</b><span className="live">● LIVE</span></header><div className="metrics"><div><small>POLICY DECISIONS</small><b>{receipt ? "129" : "128"}</b><span>{receipt ? "new receipt captured" : "+12 this session"}</span></div><div><small>BLOCKED CHAINS</small><b className="warning">{receipt ? "04" : "03"}</b><span>all receipts valid</span></div><div><small>UPSTREAM MCP</small><b>04</b><span>healthy</span></div></div><div className="receipt"><div><span className="pill">{receipt?.decision?.toUpperCase() ?? "READY"}</span><b>{receipt ? "External context attempted secret egress" : "Run the safe fixture to obtain a live receipt"}</b><small>{receipt ? `policy / ${receipt.policy}` : "gateway / waiting for replay"}</small>{receipt && <code title={receipt.hash}>sha256 / {receipt.hash.slice(0, 16)}…</code>}</div><span className="check">{receipt ? "✓" : "○"}</span></div>{receipt && <p className="receipt-reason">{receipt.reason}</p>}</div></section>
    <footer><span>ATREIDES / SECURITY BY PROOF</span><span>BUILT FOR THE MCP ERA</span><span>© 2026</span></footer>
  </main>;
}
