import type { Interface } from "node:readline";
import type { ServerState } from "../types.js";

export async function stdioTransport(rl: Interface, state: ServerState) {
  state.logger.info?.("Starting MCP STDIO transport (placeholder implementation)");

  rl.on("line", (line) => {
    state.logger.info?.(`Received STDIO input: ${line}`);
    // TODO: Replace echo logic with protocol-compliant message handling.
    rl.write(`echo: ${line}\n`);
  });

  return new Promise<void>((resolve) => {
    rl.on("close", () => {
      state.logger.info?.("STDIO transport closed");
      resolve();
    });
  });
}
