#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createMCPServer } from "../index.js";

const argv = await yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    type: "number",
    default: 8080,
    describe: "Port for the MCP HTTP server",
  })
  .help()
  .parseAsync();

const server = createMCPServer();
server.handleHttp(argv.port).catch((error) => {
  console.error("HTTP server failed", error);
  process.exit(1);
});
