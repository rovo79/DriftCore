#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createMCPServer } from "../index.js";

async function main() {
  const argv = (await yargs(hideBin(process.argv))
    .option("port", {
      alias: "p",
      type: "number",
      default: 8080,
      describe: "Port for the MCP HTTP server",
    })
    .help()
    .parseAsync()) as { port?: number };

  const port = typeof argv.port === "number" ? argv.port : 8080;
  const server = createMCPServer();
  await server.handleHttp(port);
}

main().catch((error) => {
  console.error("HTTP server failed", error);
  process.exit(1);
});
