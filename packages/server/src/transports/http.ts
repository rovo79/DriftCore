import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerState } from "../types.js";

export function httpTransport(
  req: IncomingMessage,
  res: ServerResponse,
  state: ServerState
) {
  state.logger.info?.(`HTTP ${req.method} ${req.url}`);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", tools: state.tools.length }));
    return;
  }

  // TODO: Implement protocol-compliant HTTP transport routing.
  res.writeHead(202);
  res.end(JSON.stringify({ message: "MCP HTTP transport stub" }));
}
