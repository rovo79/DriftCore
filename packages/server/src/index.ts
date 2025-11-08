import { createInterface } from "node:readline";
import http from "node:http";
import { stdioTransport } from "./transports/stdio.js";
import { httpTransport } from "./transports/http.js";
import type { MCPServerOptions } from "./types.js";

export function createMCPServer(options: MCPServerOptions = {}) {
  const { logger = console } = options;
  const serverState = {
    resources: options.resources ?? [],
    tools: options.tools ?? [],
    logger,
  };

  return {
    async handleStdio() {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      await stdioTransport(rl, serverState);
    },
    async handleHttp(port = 8080) {
      const server = http.createServer((req, res) => {
        httpTransport(req, res, serverState);
      });
      return new Promise<void>((resolve) => {
        server.listen(port, () => {
          logger.info?.(`MCP server listening on http://localhost:${port}`);
          resolve();
        });
      });
    },
  };
}

export type { MCPServerOptions } from "./types.js";
