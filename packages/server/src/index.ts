import { createInterface } from "node:readline";
import http from "node:http";
import { stdioTransport } from "./transports/stdio.js";
import { httpTransport } from "./transports/http.js";
import type { MCPServerOptions } from "./types.js";
import { listSchemaResources } from "./features/schemaResources.js";
import { getDrushTools } from "./features/drushTools.js";

export function createMCPServer(options: MCPServerOptions = {}) {
  const { logger = console } = options;
  const serverState = {
    resources: options.resources ?? listSchemaResources(),
    tools: options.tools ?? getDrushTools(),
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
      return new Promise<http.Server>((resolve) => {
        server.listen(port, () => {
          logger.info?.(`MCP server listening on http://localhost:${(server.address() as any)?.port ?? port}`);
          resolve(server);
        });
      });
    },
  };
}

export type { MCPServerOptions } from "./types.js";
