import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createMCPServer } from "../index.js";

export async function runServerSmokeTest() {
  const server = createMCPServer({ logger: console });
  assert.ok(server, "Server factory should return handlers");
  const httpServer = await server.handleHttp(0);
  const address = httpServer.address() as AddressInfo;
  assert.ok(address, "Server should have a bound address");

  const baseUrl = `http://localhost:${address.port}`;

  const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
  assert.equal(health.status, "ok");
  assert.equal(typeof health.tools, "number");

  const resources = await fetch(`${baseUrl}/resources`).then((res) => res.json());
  assert.ok(Array.isArray(resources.resources));

  const manifest = await fetch(`${baseUrl}/project-manifest`).then((res) => res.json());
  assert.ok(manifest.status);

  const drushStatus = await fetch(`${baseUrl}/drush/status`).then((res) => res.json());
  assert.ok(drushStatus.status);

  const composerInfo = await fetch(`${baseUrl}/composer/info`).then((res) => res.json());
  assert.ok(composerInfo.status);

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
