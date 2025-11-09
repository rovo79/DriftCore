import type { IncomingMessage, ServerResponse } from "node:http";
import type { ServerState } from "../types.js";

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

export function httpTransport(
  req: IncomingMessage,
  res: ServerResponse,
  state: ServerState
) {
  state.logger.info?.(`HTTP ${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      status: "ok",
      tools: state.tools.length,
      resources: state.resources.length,
    });
    return;
  }

  if (req.method === "GET" && req.url === "/resources") {
    sendJson(res, 200, { resources: state.resources });
    return;
  }

  if (req.method === "GET" && req.url === "/tools") {
    sendJson(res, 200, { tools: state.tools });
    return;
  }

  sendJson(res, 404, { error: "Not Found" });
}
