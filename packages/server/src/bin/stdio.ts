#!/usr/bin/env node
import { createMCPServer } from "../index.js";

const server = createMCPServer();
server.handleStdio().catch((error) => {
  console.error("STDIO server failed", error);
  process.exit(1);
});
