#!/usr/bin/env node
import { Console } from "node:console";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseCliArgs, type DriftCoreCliOptions } from "../cli.js";
import { createDriftCoreMcpServer } from "../mcp/server.js";
import { createServerState } from "../serverState.js";
import type { MCPServerOptions } from "../types.js";

// Both Console streams must use stderr, including configuration and operation info.
const logger = new Console({ stdout: process.stderr, stderr: process.stderr });

export async function runMcpStdio(options: MCPServerOptions & DriftCoreCliOptions = {}): Promise<void> {
  const state = createServerState({ ...options, discoverProject: true, logger });
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
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    logger.info("Usage: driftcore [--project-root <path>] [--config <path>]");
    return;
  }
  await runMcpStdio(options);
}

// Importing the runner must not launch a process or attach stdin listeners.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error: unknown) => {
    logger.error("MCP STDIO server failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
