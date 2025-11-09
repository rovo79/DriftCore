import assert from "node:assert/strict";
import { createMCPServer } from "../index.js";

export async function runServerSmokeTest() {
  const server = createMCPServer({ logger: console });
  assert.ok(server, "Server factory should return handlers");
  const httpServer = await server.handleHttp(0);
  const address = httpServer.address();
  assert.ok(address, "Server should have a bound address");
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runServerSmokeTest()
    .then(() => {
      console.info("HTTP transport smoke test completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("HTTP transport smoke test failed", error);
      process.exit(1);
    });
}
