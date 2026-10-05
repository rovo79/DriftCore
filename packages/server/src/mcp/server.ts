import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServerState } from "../types.js";
import { registerReadOnlyTools } from "./readTools.js";
import { registerDriftCoreResources } from "./resources.js";
import { registerWriteWorkflowTools } from "./writeTools.js";

export function createDriftCoreMcpServer(state: ServerState): McpServer {
  const metadata: unknown = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  if (!metadata || typeof metadata !== "object" || !("version" in metadata)
    || typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("DriftCore package metadata is missing a version");
  }
  const server = new McpServer({ name: "driftcore", version: metadata.version });
  registerDriftCoreResources(server, state);
  registerReadOnlyTools(server, state);
  registerWriteWorkflowTools(server, state);
  return server;
}
