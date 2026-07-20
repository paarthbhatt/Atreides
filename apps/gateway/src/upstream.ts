import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type UpstreamTool = { name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: { destructiveHint?: boolean } };
export type UpstreamToolClient = { listTools(): Promise<UpstreamTool[]>; callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown>; close?(): void };
export type UpstreamConfig = { command: string; args?: string[]; cwd?: string; env?: Record<string, string> };

export class StdioMcpUpstream implements UpstreamToolClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(reason: Error): void }>();
  private nextId = 0;
  private buffer = "";

  private constructor(config: UpstreamConfig) {
    this.child = spawn(config.command, config.args ?? [], { cwd: config.cwd, env: { ...process.env, ...config.env }, stdio: "pipe" });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.consume(chunk));
    this.child.stderr.on("data", () => undefined);
    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("exit", (code) => this.rejectAll(new Error(`Upstream MCP process exited (${code ?? "unknown"}).`)));
  }

  static async connect(config: UpstreamConfig) {
    const upstream = new StdioMcpUpstream(config);
    await upstream.request("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "atreides", version: "0.1.0" } });
    upstream.notify("notifications/initialized", {});
    return upstream;
  }

  async listTools() {
    const result = await this.request("tools/list", {}) as { tools?: UpstreamTool[] };
    return result.tools ?? [];
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    return this.request("tools/call", { name, arguments: arguments_ });
  }

  close() { this.child.kill(); }

  private consume(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim(); this.buffer = this.buffer.slice(newline + 1);
      if (line) {
        try {
          const message = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } };
          if (typeof message.id === "number") {
            const pending = this.pending.get(message.id); this.pending.delete(message.id);
            if (pending) {
              if (message.error) pending.reject(new Error(message.error.message ?? "Upstream MCP error"));
              else pending.resolve(message.result);
            }
          }
        } catch { /* Ignore non-protocol stdout lines without treating them as tool output. */ }
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  private request(method: string, params: Record<string, unknown>) {
    const id = ++this.nextId;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise<unknown>((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  private notify(method: string, params: Record<string, unknown>) { this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`); }
  private rejectAll(error: Error) { for (const pending of this.pending.values()) pending.reject(error); this.pending.clear(); }
}

export async function connectConfiguredUpstream() {
  const command = process.env.ATREIDES_UPSTREAM_COMMAND;
  if (!command) return undefined;
  const args = process.env.ATREIDES_UPSTREAM_ARGS ? JSON.parse(process.env.ATREIDES_UPSTREAM_ARGS) as string[] : [];
  return StdioMcpUpstream.connect({ command, args, cwd: process.env.ATREIDES_UPSTREAM_CWD });
}
