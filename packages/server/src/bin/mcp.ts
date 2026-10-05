#!/usr/bin/env node
import { Console } from "node:console";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDriftCoreMcpServer } from "../mcp/server.js";
import { createServerState } from "../serverState.js";
import type { MCPServerOptions } from "../types.js";

// Both Console streams must use stderr, including configuration and operation info.
const logger = new Console({ stdout: process.stderr, stderr: process.stderr });

export async function runMcpStdio(options: MCPServerOptions = {}): Promise<void> {
  const state = createServerState({ ...options, logger });
  if (state.configError) {
    throw new Error(`${state.configError.code}: ${state.configError.message}`);
  }
  const server = createDriftCoreMcpServer(state);
  try {
    await server.connect(new StdioServerTransport());
  } catch (error) {
    await server.close();
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let configPath: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      logger.info("Usage: node dist/bin/mcp.js [--config <path>]");
      return;
    }
    if (arg === "--config" || arg.startsWith("--config=")) {
      configPath = arg === "--config" ? args[++index] : arg.slice("--config=".length);
      if (!configPath || configPath.startsWith("--")) {
        throw new Error("--config requires a configuration file path");
      }
    } else {
      throw new Error(`Unknown MCP option: ${arg}`);
    }
  }
  await runMcpStdio({ configPath });
}

// Importing the runner must not launch a process or attach stdin listeners.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    logger.error("MCP STDIO server failed", error);
    process.exitCode = 1;
  });
}
