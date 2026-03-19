import { createInterface } from "node:readline";
import http from "node:http";
import { stdioTransport } from "./transports/stdio.js";
import { httpTransport } from "./transports/http.js";
import type { MCPServerOptions, OperationMeta, ServerState } from "./types.js";
import { loadServerConfig, validateBinaryPaths } from "./config.js";
import { listDiscoveredResources } from "./features/discoveredResources.js";
import { listSchemaResources } from "./features/schemaResources.js";
import { getDrushTools } from "./features/drushTools.js";
import { getComposerTools } from "./features/composerTools.js";
import { getWorkflowTools } from "./features/workflows/index.js";
import { createRateLimiter } from "./features/rateLimiter.js";

export function createMCPServer(options: MCPServerOptions = {}) {
  const { logger = console } = options;
  const loadedConfig = loadServerConfig({
    logger,
    configPath: options.configPath,
  });

  if (!loadedConfig.config) {
    logger.warn?.(
      `DriftCore server is running without a valid configuration${
        loadedConfig.error ? ` (${loadedConfig.error.message})` : ""
      }`,
    );
  }

  const binaryValidation = validateBinaryPaths(loadedConfig.config);
  const requestRateLimiter = loadedConfig.config
    ? createRateLimiter({
        windowMs: loadedConfig.config.rateLimit?.windowMs ?? 60000,
        maxRequests: loadedConfig.config.rateLimit?.maxRequests ?? 60,
      })
    : undefined;

  async function withOperationLogging<T>(
    meta: OperationMeta,
    executor: () => Promise<T> | T,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await executor();
      const status =
        result && typeof result === "object" && "status" in (result as Record<string, unknown>)
          ? ((result as Record<string, unknown>).status as string)
          : "ok";
      logger.info?.(
        `[mcp] kind=${meta.kind} name=${meta.name} status=${status} durationMs=${Date.now() - start}`,
      );
      return result;
    } catch (error) {
      logger.error?.(
        `[mcp] kind=${meta.kind} name=${meta.name} status=exception durationMs=${
          Date.now() - start
        }`,
        error,
      );
      throw error;
    }
  }

  const serverState: ServerState = {
    resources: options.resources ?? [...listSchemaResources(), ...listDiscoveredResources()],
    tools: options.tools ?? [...getDrushTools(), ...getComposerTools(), ...getWorkflowTools()],
    logger,
    config: loadedConfig.config,
    configError: loadedConfig.error,
    binaryValidation,
    httpHost: undefined,
    requestRateLimiter,
    runOperation: withOperationLogging,
  };

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
          logger.info?.(`MCP server listening on http://${host}:${(server.address() as any)?.port ?? port}`);
          resolve(server);
        });
      });
    },
  };
}

export type { MCPServerOptions } from "./types.js";
