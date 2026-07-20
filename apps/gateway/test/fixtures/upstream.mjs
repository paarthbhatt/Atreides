let buffer = "";

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline = buffer.indexOf("\n");
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim(); buffer = buffer.slice(newline + 1);
    if (line) {
      const request = JSON.parse(line);
      if (request.method === "initialize") reply(request.id, { protocolVersion: "2025-03-26", capabilities: {}, serverInfo: { name: "fixture", version: "1" } });
      if (request.method === "tools/list") reply(request.id, { tools: [{ name: "fixture.echo", description: "Echo a safe fixture." }] });
      if (request.method === "tools/call") reply(request.id, { content: [{ type: "text", text: JSON.stringify(request.params) }] });
    }
    newline = buffer.indexOf("\n");
  }
});
