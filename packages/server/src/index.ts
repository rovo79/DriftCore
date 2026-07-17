import { createInterface } from "node:readline";
import http from "node:http";
import { stdioTransport } from "./transports/stdio.js";
import { httpTransport } from "./transports/http.js";
import { createServerState } from "./serverState.js";
import type { MCPServerOptions } from "./types.js";

export function createMCPServer(options: MCPServerOptions = {}) {
  const serverState = createServerState(options);

  return {
    async handleStdio() {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await stdioTransport(rl, serverState);
    },
    async handleHttp(port = 8080, host = "127.0.0.1") {
      serverState.httpHost = host;
      const server = http.createServer((req, res) => {
        httpTransport(req, res, serverState);
      });
      return new Promise<http.Server>((resolve) => {
        server.listen(port, host, () => {
          serverState.logger.info?.(
            `MCP server listening on http://${host}:${(server.address() as any)?.port ?? port}`,
          );
          resolve(server);
        });
      });
    },
  };
}

export type { MCPServerOptions } from "./types.js";
export { createServerState } from "./serverState.js";
